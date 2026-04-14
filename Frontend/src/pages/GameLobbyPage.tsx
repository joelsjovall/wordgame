import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";

function GameLobbyPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const sessionCode = queryParams.get("code") || "";
  const username = queryParams.get("user");

  const [players, setPlayers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [words, setWords] = useState("");
  const [correctCount, setCorrectCount] = useState(0);

  // Hämta spelare
  useEffect(() => {
    fetch(`http://localhost:5000/api/games/${sessionCode}/players`)
      .then((res) => res.json())
      .then((data) => setPlayers(data));
  }, [sessionCode]);

  // Hämta kategorier
  useEffect(() => {
    fetch("http://localhost:5000/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data));
  }, []);

  // Räkna rätt ord (placeholder-logik)
  const handleCountWords = () => {
    const list = words
      .split(",")
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    setCorrectCount(list.length);
  };

  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Game Lobby</h1>

        {/* Spelare */}
        <h2>Players</h2>
        <ul>
          {players.map((p: any) => (
            <li key={p.id}>{p.username}</li>
          ))}
        </ul>

        <div className="divider" aria-hidden="true"></div>

        {/* Kategorier */}
        <label className="code-label">Choose category</label>
        <select
          className="code-input"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">Select...</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="divider" aria-hidden="true"></div>

        {/* Ord-input */}
        <label className="code-label">Your words (comma separated)</label>
        <textarea
          className="code-input"
          rows={4}
          placeholder="Volvo, BMW, Audi..."
          value={words}
          onChange={(e) => setWords(e.target.value)}
        />

        <button className="primary" type="button" onClick={handleCountWords}>
          Count correct words
        </button>

        <h3>Correct: {correctCount}</h3>

        <div className="divider" aria-hidden="true"></div>

        <Link to="/">Back</Link>
      </section>
    </main>
  );
}

export default GameLobbyPage;
