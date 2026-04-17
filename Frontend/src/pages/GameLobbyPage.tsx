import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type Player = {
  id: number | string;
  username: string;
  score?: number;
  turnOrder?: number;
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
    if (!sessionCode) {
      return;
    }

    let isMounted = true;

    const loadPlayers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/games/${sessionCode}/players`);
        if (!response.ok) {
          throw new Error("Could not fetch players");
        }

        const data = (await response.json()) as Player[];
        if (isMounted) {
          setPlayers(data);
        }
      } catch {
        if (isMounted) {
          console.log("Could not fetch players");
        }
      }
    };

    void loadPlayers();
    const intervalId = window.setInterval(() => {
      void loadPlayers();
    }, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
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

  const validateWord = (word: string) => word.length > 2;

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

  const displayPlayers = Array.from({ length: 4 }, (_, index) => {
    const player = players
      .slice()
      .sort((left, right) => (left.turnOrder ?? 99) - (right.turnOrder ?? 99))[index];

    return player ?? {
      id: `slot-${index + 1}`,
      username: `Player ${index + 1}`,
      score: 0
    };
  });
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
