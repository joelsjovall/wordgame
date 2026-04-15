import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

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

const difficultyOptions: { key: "easy" | "medium" | "hard"; label: string; points: number }[] = [
  { key: "easy", label: "Easy", points: 1 },
  { key: "medium", label: "Medium", points: 2 },
  { key: "hard", label: "Hard", points: 3 },
];

function GameLobbyPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const sessionCode = queryParams.get("code") || "";

  const [players, setPlayers] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"easy" | "medium" | "hard" | "">("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");

  const [currentWord, setCurrentWord] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults] = useState<{ word: string; correct: boolean }[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/games/${sessionCode}/players`)
      .then((res) => res.json())
      .then((data) => setPlayers(data))
      .catch(() => console.log("Could not fetch players"));
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

  const selectedCategoryName = categories.find((category) => String(category.id) === selectedCategory)?.name;

  return (
    <main className="page">
      <section className="card">
        <h1 className="title">Game Lobby</h1>

        <h2>Players</h2>
        <ul>
          {players.map((player) => (
            <li key={player.id}>{player.username}</li>
          ))}
        </ul>

        <div className="divider" aria-hidden="true"></div>

        <label className="code-label">Choose category</label>
        <button className="primary" type="button" onClick={() => setIsCategoryModalOpen(true)}>
          Category
        </button>

        {selectedDifficulty && (
          <p>
            Difficulty: <strong>{selectedDifficulty}</strong>
          </p>
        )}

        {selectedCategory && (
          <p>
            Selected category: <strong>{selectedCategoryName ?? selectedCategory}</strong>
          </p>
        )}

        <div className="divider" aria-hidden="true"></div>

        <label className="code-label">Type your word</label>
        <input
          className="code-input"
          type="text"
          placeholder="Type a word and press Enter"
          value={currentWord}
          onChange={(e) => setCurrentWord(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <h3>Results</h3>
        <ul>
          {results.map((result, index) => (
            <li key={index} style={{ color: result.correct ? "green" : "red" }}>
              {result.word} {result.correct ? "Correct" : "Incorrect"}
            </li>
          ))}
        </ul>

        <h3>Correct: {correctCount}</h3>

        <div className="divider" aria-hidden="true"></div>

        <Link to="/">Back</Link>
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
