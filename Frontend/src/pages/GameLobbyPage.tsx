import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";

function GameLobbyPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const sessionCode = queryParams.get("code") || "";
  const username = queryParams.get("user") || "";

  const [players, setPlayers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  // Word input states
  const [currentWord, setCurrentWord] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults] = useState<{ word: string; correct: boolean; }[]>([]);

  // Hämta spelare
  useEffect(() => {
    fetch(`http://localhost:5000/api/games/${sessionCode}/players`)
      .then((res) => res.json())
      .then((data) => setPlayers(data))
      .catch(() => console.log("Kunde inte hämta spelare"));
  }, [sessionCode]);

  // Hämta kategorier
  useEffect(() => {
    fetch("http://localhost:5000/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch(() => console.log("Kunde inte hämta kategorier"));
  }, []);

  // Placeholder-validering (byt ut mot backend senare)
  const validateWord = (word: string) => {
    return word.length > 2;
  };

  // Enter → skicka ordet
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitWord();
    }
  };

  // Skicka ordet
  const submitWord = () => {
    const trimmed = currentWord.trim();
    if (!trimmed) return;

    const isCorrect = validateWord(trimmed);

    setResults((prev) => [...prev, { word: trimmed, correct: isCorrect }]);

    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
    }

    setCurrentWord("");
  };

  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Game Lobby</h1>

        {/* Spelare */}
        <h2>Players</h2>
        <ul>
          {players.map((p) => (
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
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="divider" aria-hidden="true"></div>

        {/* Ord-input */}
        <label className="code-label">Type your word</label>
        <input
          className="code-input"
          type="text"
          placeholder="Type a word and press Enter"
          value={currentWord}
          onChange={(e) => setCurrentWord(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Resultat */}
        <h3>Results</h3>
        <ul>
          {results.map((r, i) => (
            <li key={i} style={{ color: r.correct ? "green" : "red" }}>
              {r.word} {r.correct ? "✓" : "✗"}
            </li>
          ))}
        </ul>

        <h3>Correct: {correctCount}</h3>

        <div className="divider" aria-hidden="true"></div>

        <Link to="/">Back</Link>
      </section>
    </main>
  );
}

export default GameLobbyPage;
