import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";


function CreateGamePage() {
  const [username, setUsername] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const navigate = useNavigate();


  // Generera 6-siffrig kod när sidan laddas
  useEffect(() => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSessionCode(code);
  }, []);

  const handleContinue = () => {
    if (!username) {
      alert("Please enter a username");
      return;
    }

    // TODO: skicka username + sessionCode till backend

    navigate(`/lobby?code=${sessionCode}&user=${username}`);
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
          <h2>{sessionCode}</h2>
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
