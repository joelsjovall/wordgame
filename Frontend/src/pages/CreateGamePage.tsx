import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../utils/apiBaseUrl";

type CreateGameResponse = {
  gameId: number;
  code: string;
  userId: number;
  username: string;
};

function CreateGamePage() {
  const [username, setUsername] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleContinue = async () => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      alert("Please enter a username");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizedUsername }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Could not create game");
      }

      const data = (await response.json()) as CreateGameResponse;
      setSessionCode(data.code);
      navigate(
        `/lobby?code=${encodeURIComponent(data.code)}&gameId=${data.gameId}&user=${encodeURIComponent(data.username)}&playerId=${data.userId}`
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not create game");
    } finally {
      setIsCreating(false);
    }
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

        <button className="primary" type="button" onClick={() => void handleContinue()} disabled={isCreating}>
          {isCreating ? "Creating..." : "Continue"}
        </button>

        <div className="divider" aria-hidden="true"></div>

        <Link to="/">Back</Link>
      </section>
    </main>
  );
}

export default CreateGamePage;
