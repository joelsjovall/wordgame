import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type Player = {
  id: string | number;
  username: string;
  score?: number;
};

type Category = {
  id: string | number;
  name: string;
};

type Result = {
  word: string;
  correct: boolean;
};

function GameLobbyPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const sessionCode = queryParams.get("code") || "";
  const username = queryParams.get("user") || "";

  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [currentWord, setCurrentWord] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  const fallbackPlayers: Player[] = [
    { id: "slot-1", username: username || "Player 1", score: 100 },
    { id: "slot-2", username: "Player 2", score: 250 },
    { id: "slot-3", username: "Player 3", score: 123 },
    { id: "slot-4", username: "Player 4", score: 123 },
  ];

  const orderedPlayers = players.length
    ? (() => {
        const currentPlayerIndex = players.findIndex(
          (player) => player.username?.toLowerCase() === username.toLowerCase()
        );

        if (currentPlayerIndex <= 0) {
          return players;
        }

        const currentPlayer = players[currentPlayerIndex];
        const remainingPlayers = players.filter((_, index) => index !== currentPlayerIndex);
        return [currentPlayer, ...remainingPlayers];
      })()
    : [];

  const displayPlayers: Player[] = orderedPlayers.length
    ? [
        ...orderedPlayers,
        ...fallbackPlayers.filter(
          (fallbackPlayer) =>
            !orderedPlayers.some((player) => String(player.id) === String(fallbackPlayer.id))
        ),
      ]
    : fallbackPlayers;

  const selectedCategoryName =
    categories.find((category) => String(category.id) === selectedCategory)?.name ||
    "Category_name";

  const answersLeft = Math.max(0, 10 - correctCount);

  useEffect(() => {
    fetch(`http://localhost:5000/api/games/${sessionCode}/players`)
      .then((res) => res.json())
      .then((data) => setPlayers(data))
      .catch(() => console.log("Could not fetch players"));
  }, [sessionCode]);

  useEffect(() => {
    fetch("http://localhost:5000/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch(() => console.log("Could not fetch categories"));
  }, []);

  const validateWord = (word: string) => {
    return word.length > 2;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitWord();
    }
  };

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
      <section className="card lobby-card">
        <div className="lobby-topbar">
          <div>
            <h1 className="title lobby-title">Game Lobby</h1>
            <p className="lobby-session">
              Room: <span>{sessionCode || "XXXX-XXXX"}</span>
              {username ? ` | ${username}` : ""}
            </p>
          </div>
          <Link className="rules-link" to="/">
            Back
          </Link>
        </div>

        <div className="player-strip">
          {displayPlayers.slice(0, 4).map((player, index) => (
            <article className="player-panel" key={player.id ?? index}>
              <h2 className="player-name">{player.username || `Player ${index + 1}`}</h2>
              <div className="player-score-box">
                <span>{player.score ?? 0} P</span>
              </div>
            </article>
          ))}
        </div>

        <div className="lobby-layout">
          <aside className="history-panel">
            <h3 className="history-title">Word guesses history</h3>
            <ul className="history-list">
              {results.length ? (
                results.map((result, index) => (
                  <li
                    className={result.correct ? "history-item correct" : "history-item incorrect"}
                    key={`${result.word}-${index}`}
                  >
                    <span>{result.word}</span>
                    <span>{result.correct ? "Correct" : "Wrong"}</span>
                  </li>
                ))
              ) : (
                <li className="history-empty">No guesses yet</li>
              )}
            </ul>
          </aside>

          <div className="lobby-main">
            <section className="category-panel">
              <p className="category-display">
                Category: <span>{selectedCategoryName}</span>
              </p>
              <label className="lobby-select-label" htmlFor="category-select">
                Change category
              </label>
              <select
                id="category-select"
                className="lobby-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">Select...</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </section>

            <section className="word-panel">
              <label className="word-label" htmlFor="word-input">
                Type your word
              </label>
              <input
                id="word-input"
                className="word-input"
                type="text"
                placeholder="Write a word and press Enter"
                value={currentWord}
                onChange={(e) => setCurrentWord(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </section>

            <section className="score-summary">
              <p>
                Correct answers: <span>{correctCount}</span>
              </p>
              <p>
                Answers left: <span>{answersLeft}</span>
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

export default GameLobbyPage;
