import { Link } from 'react-router-dom';

function Home() {
  return (
    <main className="page">
      <section className="card">
        <h1 className="title">WordGame</h1>

        <button className="primary" type="button">
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
          inputMode="text"
        />

        <div className="divider" aria-hidden="true"></div>
        <Link to="/rules">Rules</Link>
      </section>
    </main>
  );
}

export default Home;
