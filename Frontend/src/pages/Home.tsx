import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const handleJoin = () => {
    if (!code) return;
    navigate(`/join?code=${code}`);
  };

  return (
    <main className="page">
      <section className="card">
        <h1 className="title">WordGame</h1>

        <button
          className="primary"
          type="button"
          onClick={() => navigate("/create")}
        >
          New game
        </button>

        <div className="divider" aria-hidden="true"></div>

        <label className="code-label" htmlFor="room-code">
          Enter code
        </label>
        <input
          id="room-code"
          className="code-input"
          type="text"
          placeholder="XXXX-XXXX"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="text"
        />

        <button className="primary" type="button" onClick={handleJoin}>
          Join game
        </button>

        <div className="divider" aria-hidden="true"></div>
        <Link to="/rules">Rules</Link>
      </section>
    </main>
  );
}

export default Home;
