require("dotenv").config();
const Document = require("./models/document");

const ANYSCALE_API_KEY = process.env.ANYSCALE_API_KEY;

// some information about this model: https://ai.meta.com/llama/
const MODEL = "meta-llama/Llama-2-13b-chat-hf";

// another common choice of embedding model is text-embedding-ada-002.
// we use gte-large because this is the only embedding model anyscale has access to
const EMBEDDING_MODEL = "thenlper/gte-large";

// anyscale uses openAI under the hood! but anyscale gives us $10 free credits
const { OpenAI } = require("openai");
const anyscale = new OpenAI({
  baseURL: "https://api.endpoints.anyscale.com/v1",
  apiKey: ANYSCALE_API_KEY,
});

// embedding helper function
const generateEmbedding = async (document) => {
  const embedding = await anyscale.embeddings.create({
    model: EMBEDDING_MODEL,
    input: document,
  });
  return embedding.data[0].embedding;
};

// chat completion helper function
const chatCompletion = async (query, context) => {
  const prompt = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "Your role is to answer questions for a user. You are given the following context to help you answer questions: \n" +
          `${context}. \n` +
          "Please do not mention that you were given any context in your response.",
      },
      { role: "user", content: `${query}` },
    ],
    // temperature controls the variance in the llms responses
    // higher temperature = more variance
    temperature: 0.7,
  };
  const completion = await anyscale.chat.completions.create(prompt);
  return completion.choices[0].message.content;
};

// initialize vector database
const COLLECTION_NAME = "catbook-collection";
const { ChromaClient } = require("chromadb");
const client = new ChromaClient();

let collection;

// sync main and vector dbs
const syncDBs = async () => {
  // retrieve all documents
  const allDocs = await collection.get();
  // delete all documents
  await collection.delete({
    ids: allDocs.ids,
  });
  // retrieve corpus from main db
  const allMongoDocs = await Document.find({});
  const allMongoDocIds = allMongoDocs.map((mongoDoc) => mongoDoc._id.toString());
  const allMongoDocContent = allMongoDocs.map((mongoDoc) => mongoDoc.content);
  let allMongoDocEmbeddings = allMongoDocs.map((mongoDoc) => generateEmbedding(mongoDoc.content));
  allMongoDocEmbeddings = await Promise.all(allMongoDocEmbeddings); // ensure embeddings finish generating
  // add corpus to vector db
  await collection.add({
    ids: allMongoDocIds,
    embeddings: allMongoDocEmbeddings,
    documents: allMongoDocContent,
  });
  console.log("number of documents", await collection.count());
};

const initCollection = async () => {
  collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
  });
  // initialize collection embeddings with corpus
  // in production, this function should not run that often, so it is OK to resync the two dbs here
  await syncDBs();
  console.log("finished initializing chroma collection");
};

initCollection();

// retrieving context helper function
const NUM_DOCUMENTS = 2;
const retrieveContext = async (query, k) => {
  const queryEmbedding = await generateEmbedding(query);
  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: k,
  });
  return results.documents;
};

// RAG
const retrievalAugmentedGeneration = async (query) => {
  const context = await retrieveContext(query, NUM_DOCUMENTS);
  const llmResponse = await chatCompletion(query, context);
  return llmResponse;
};

// add a document to collection
const addDocument = async (document) => {
  const embedding = await generateEmbedding(document.content);
  await collection.add({
    ids: [document._id.toString()],
    embeddings: [embedding],
    documents: [document.content],
  });
};

// update a document in collection
const updateDocument = async (document) => {
  await collection.delete({ ids: [document._id.toString()] });
  await addDocument(document);
};

// delete a document in collection
const deleteDocument = async (id) => {
  await collection.delete({
    ids: [id.toString()],
  });
};

module.exports = {
  addDocument: addDocument,
  updateDocument: updateDocument,
  deleteDocument: deleteDocument,
  retrievalAugmentedGeneration: retrievalAugmentedGeneration,
};
