import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function JoinGamePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hämta koden från querystring, t.ex. /join?code=123456
  const queryParams = new URLSearchParams(location.search);
  const sessionCode = queryParams.get("code") || "";

  const [username, setUsername] = useState("");
  const handleJoin = async () => {
    if (!username) {
      alert("Please enter a username");
      return;
    }

    // Skicka username + sessionCode till backend
    const res = await fetch(`${API_BASE_URL}/api/games/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        code: sessionCode
      })
    });

    if (!res.ok) {
      alert("Could not join game");
      return;
    }

    const data: { gameId: number; code: string; userId: number; username: string; } = await res.json();

    // Navigera till lobby
    navigate(`/lobby?code=${encodeURIComponent(data.code)}&gameId=${data.gameId}&user=${encodeURIComponent(data.username)}&playerId=${data.userId}`);
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
