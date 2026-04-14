import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

function JoinGamePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hämta koden från querystring, t.ex. /join?code=123456
  const queryParams = new URLSearchParams(location.search);
  const sessionCode = queryParams.get("code") || "";

  const [username, setUsername] = useState("");

  const handleJoin = () => {
    if (!username) {
      alert("Please enter a username");
      return;
    }

    // TODO: Skicka username + sessionCode till backend
    console.log("Joining game:", { username, sessionCode });

    // TODO: navigate till lobby
    // navigate(`/lobby/${sessionCode}`);
  };

  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Join Game</h1>

        <label className="code-label">Game code</label>
        <div className="session-code-display">
          <h2>{sessionCode}</h2>
        </div>

        <div className="divider" aria-hidden="true"></div>

        <label className="code-label" htmlFor="username">
          Enter username
        </label>
        <input
          id="username"
          className="code-input"
          type="text"
          placeholder="Your name"
          autoComplete="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <button className="primary" type="button" onClick={handleJoin}>
          Join game
        </button>

        <div className="divider" aria-hidden="true"></div>

        <Link to="/">Back</Link>
      </section>
    </main>
  );
}

export default JoinGamePage;
