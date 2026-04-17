import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function JoinGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const [sessionCode, setSessionCode] = useState(queryParams.get("code") || "");
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJoin = async () => {
    const normalizedCode = sessionCode.trim();
    const normalizedUsername = username.trim();

    if (!normalizedCode) {
      alert("Please enter a game code");
      return;
    }

    if (!normalizedUsername) {
      alert("Please enter a username");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/games/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedUsername,
          code: normalizedCode
        })
      });

      if (!res.ok) {
        alert("Could not join game");
        return;
      }

      navigate(`/lobby?code=${normalizedCode}&user=${normalizedUsername}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Join Game</h1>

        <label className="code-label" htmlFor="session-code">
          Game code
        </label>
        <input
          id="session-code"
          className="code-input"
          type="text"
          placeholder="Enter game code"
          autoComplete="off"
          value={sessionCode}
          onChange={(e) => setSessionCode(e.target.value)}
        />

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

        <button className="primary" type="button" onClick={handleJoin} disabled={isSubmitting}>
          {isSubmitting ? "Joining..." : "Join game"}
        </button>

        <div className="divider" aria-hidden="true"></div>

        <Link to="/">Back</Link>
      </section>
    </main>
  );
}

export default JoinGamePage;
