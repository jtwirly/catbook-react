import React from "react";
import { Link } from "@reach/router";
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from "@react-oauth/google";

import "./NavBar.css";

const GOOGLE_CLIENT_ID = "645648346214-0t936jmbg6c4pbho8ns1u9iaja2oj4kg.apps.googleusercontent.com";

const NavBar = ({ userId, handleLogin, handleLogout }) => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div>
        {userId ? (
          <button
            onClick={() => {
              googleLogout();
              handleLogout();
            }}
          >
            Logout
          </button>
        ) : (
          <GoogleLogin onSuccess={handleLogin} onError={(err) => console.log(err)} />
        )}
      </div>
      <nav className="NavBar-container">
        <div className="NavBar-title u-inlineBlock">FeedMe</div>
        <div className="NavBar-linkContainer u-inlineBlock">
          <Link to="/" className="NavBar-link">
            Home
          </Link>
          {userId && (
            <Link to={`/profile/${userId}`} className="NavBar-link">
              Profile
            </Link>
          )}
          <Link to="/chat/" className="NavBar-link">
            Chat
          </Link>
        </div>
      </nav>
    </GoogleOAuthProvider>
  );
};

export default NavBar;
