import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type CreateGameResponse = {
  code: string;
};

function CreateGamePage() {
  const [username, setUsername] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const navigate = useNavigate();

  const handleContinue = async () => {
    if (!username) {
      alert("Please enter a username");
      return;
    }

    const res = await fetch(`${API_BASE_URL}/api/games/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username
      })
    });

    if (!res.ok) {
      alert("Could not create game");
      return;
    }

    const data = (await res.json()) as CreateGameResponse;
    setSessionCode(data.code);
    navigate(`/lobby?code=${data.code}&user=${username}`);
  };

  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Create Game</h1>

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

        <div className="divider" aria-hidden="true"></div>

        <label className="code-label">Your session code</label>
        <div className="session-code-display">
          <h2>{sessionCode || "Created when you continue"}</h2>
        </div>

        <p>Share this code with your friends so they can join your game.</p>

        <button className="primary" type="button" onClick={handleContinue}>
          Continue
        </button>

        <div className="divider" aria-hidden="true"></div>

        <Link to="/">Back</Link>
      </section>
    </main>
  );
}

export default CreateGamePage;
