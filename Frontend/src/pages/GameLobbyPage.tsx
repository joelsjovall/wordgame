import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";



type Player = {
  id: number | string;
  username: string;
  score?: number;
};

type Category = {
  id: number;
  name: string;
  difficulty: "easy" | "medium" | "hard" | string;
  points: number;
};

type CategoriesResponse = {
  count: number;
  categories: Category[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const difficultyOptions: { key: "easy" | "medium" | "hard"; label: string; points: number; }[] = [
  { key: "easy", label: "Easy", points: 1 },
  { key: "medium", label: "Medium", points: 2 },
  { key: "hard", label: "Hard", points: 3 },
];

function GameLobbyPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const sessionCode = queryParams.get("code") || "";
  const username = queryParams.get("user") || "";

  const userId = Number(queryParams.get("userId"));
  const roundId = Number(queryParams.get("roundId"));




  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"easy" | "medium" | "hard" | "">("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [currentWord, setCurrentWord] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults] = useState<{ word: string; correct: boolean; }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_BASE_URL}/api/games/${sessionCode}/players`)
        .then((res) => res.json())
        .then((data) => setPlayers(data))
        .catch(() => console.log("Could not fetch players"));
    }, 1000); // uppdatera varje sekund

    return () => clearInterval(interval);
  }, [sessionCode]);


  const fetchCategoriesByDifficulty = async (difficulty: "easy" | "medium" | "hard") => {
    setSelectedDifficulty(difficulty);
    setSelectedCategory("");
    setIsCategoriesLoading(true);
    setCategoriesError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/categories?difficulty=${encodeURIComponent(difficulty)}`);
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Request failed");
      }

      const data: CategoriesResponse = await response.json();
      setCategories(data.categories ?? []);
    } catch (error) {
      setCategories([]);
      setCategoriesError(
        error instanceof Error
          ? `Could not fetch categories for this difficulty. ${error.message}`
          : "Could not fetch categories for this difficulty."
      );
    } finally {
      setIsCategoriesLoading(false);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitWord();
    }
  };

  const submitWord = async () => {
    const trimmed = currentWord.trim();
    if (!trimmed) return;

    const res = await fetch(`${API_BASE_URL}/api/games/${roundId}/submit/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trimmed)
    });

    if (!res.ok) {
      console.error("Failed to submit word");
      return;
    }

    const result = await res.json();

    setResults(prev => [
      ...prev,
      {
        word: trimmed,
        correct: result.isValid && !result.isDuplicate
      }
    ]);

    if (result.isValid && !result.isDuplicate) {
      setCorrectCount(prev => prev + 1);
    }

    setCurrentWord("");
  };


  const fallbackPlayers: Player[] = [
    { id: "slot-1", username: username || "Player 1", score: 100 },
    { id: "slot-2", username: "Player 2", score: 250 },
    { id: "slot-3", username: "Player 3", score: 123 },
    { id: "slot-4", username: "Player 4", score: 123 },
  ];

  const displayPlayers = players.length ? players.slice(0, 4) : fallbackPlayers;
  const selectedCategoryName = categories.find((category) => String(category.id) === selectedCategory)?.name;
  const answersLeft = Math.max(0, 10 - correctCount);

  return (
    <main className="page">
      <section className="card sketch-lobby-card">
        <div className="sketch-lobby-top">
          <div className="sketch-room-code">Room: {sessionCode || "XXXX-XXXX"}</div>
          <Link className="rules-link sketch-back-link" to="/">
            Back
          </Link>
        </div>

        <div className="sketch-player-row">
          {displayPlayers.map((player, index) => (
            <article className="sketch-player-slot" key={player.id ?? index}>
              <h2 className="sketch-player-label">{player.username || `Player ${index + 1}`}</h2>
              <div className="sketch-player-score-box">
                <span>{player.score ?? 0}p</span>
              </div>
            </article>
          ))}
        </div>

        <div className="sketch-lobby-body">
          <aside className="sketch-history-column">
            <h3 className="sketch-history-title">Word guesses history</h3>
            <ul className="sketch-history-list">
              {results.length ? (
                results.map((result, index) => (
                  <li
                    className={result.correct ? "sketch-history-item correct" : "sketch-history-item incorrect"}
                    key={`${result.word}-${index}`}
                  >
                    <span>{result.word}</span>
                    <span>{result.correct ? "Correct" : "Incorrect"}</span>
                  </li>
                ))
              ) : (
                <li className="sketch-history-empty">No guesses yet</li>
              )}
            </ul>
          </aside>

          <section className="sketch-main-column">
            <div className="sketch-category-block">
              <p className="sketch-category-line">
                Category: <span>{selectedCategoryName ?? "Category_name"}</span>
              </p>
              <button className="primary" type="button" onClick={() => setIsCategoryModalOpen(true)}>
                Choose category
              </button>
              {selectedDifficulty && <p className="sketch-difficulty">Difficulty: {selectedDifficulty}</p>}
            </div>

            <div className="sketch-word-block">
              <label className="sketch-word-label" htmlFor="word-input">
                Type your word
              </label>
              <input
                id="word-input"
                className="sketch-word-input"
                type="text"
                placeholder="Type a word and press Enter"
                value={currentWord}
                onChange={(e) => setCurrentWord(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            <div className="sketch-stats-block">
              <p>Correct answers: {correctCount}</p>
              <p>Answer left: {answersLeft}</p>
            </div>
          </section>
        </div>
      </section>

      {isCategoryModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCategoryModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="title modal-title">Choose Difficulty</h2>

            <div className="difficulty-grid">
              {difficultyOptions.map((option) => (
                <button
                  key={option.key}
                  className="primary"
                  type="button"
                  onClick={() => void fetchCategoriesByDifficulty(option.key)}
                >
                  {option.label} ({option.points} pts)
                </button>
              ))}
            </div>

            {isCategoriesLoading && <p>Loading categories...</p>}
            {categoriesError && <p>{categoriesError}</p>}

            {!isCategoriesLoading && !categoriesError && selectedDifficulty !== "" && (
              <>
                <label className="code-label">Choose a {selectedDifficulty} category</label>
                <select
                  className="code-input"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setIsCategoryModalOpen(false);
                  }}
                >
                  <option value="">Select...</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default GameLobbyPage;
