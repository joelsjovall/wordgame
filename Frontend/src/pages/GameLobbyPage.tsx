import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type Player = {
  id: number | string;
  username: string;
  score?: number;
  playerOrder?: number;
  isReady?: boolean;
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

type LobbyGuess = {
  roundNumber: number;
  word: string;
  correct: boolean;
  submittedBy: string;
  createdAt: string;
};

type LobbyStateResponse = {
  gameStatus: "lobby" | "in-progress" | string;
  currentRoundNumber: number;
  currentTurnPlayerOrder: number | null;
  roundTargetWordCount: number;
  selectedCategoryId: number | null;
  selectedCategoryName: string;
  selectedDifficulty: string;
  guesses: LobbyGuess[];
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"easy" | "medium" | "hard" | "">("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [currentWord, setCurrentWord] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults] = useState<LobbyGuess[]>([]);
  const [gameStatus, setGameStatus] = useState<"lobby" | "in-progress" | string>("lobby");
  const [currentRoundNumber, setCurrentRoundNumber] = useState(0);
  const [currentTurnPlayerOrder, setCurrentTurnPlayerOrder] = useState<number | null>(null);
  const [roundTargetWordCount, setRoundTargetWordCount] = useState(10);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [lobbyMessage, setLobbyMessage] = useState("");

  useEffect(() => {
    if (!sessionCode) {
      return;
    }

    let isMounted = true;

    const loadLobbyData = async () => {
      try {
        const [playersResponse, lobbyStateResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/games/${sessionCode}/players`),
          fetch(`${API_BASE_URL}/api/games/${sessionCode}/lobby-state`)
        ]);

        if (!playersResponse.ok) {
          throw new Error("Could not fetch players");
        }

        if (!lobbyStateResponse.ok) {
          throw new Error("Could not fetch lobby state");
        }

        const playersData = (await playersResponse.json()) as Player[];
        const lobbyStateData = (await lobbyStateResponse.json()) as LobbyStateResponse;
        if (isMounted) {
          setPlayers(playersData);
          setGameStatus(lobbyStateData.gameStatus ?? "lobby");
          setCurrentRoundNumber(lobbyStateData.currentRoundNumber ?? 0);
          setCurrentTurnPlayerOrder(lobbyStateData.currentTurnPlayerOrder ?? null);
          setRoundTargetWordCount(lobbyStateData.roundTargetWordCount ?? 10);
          if (!isCategoryModalOpen || lobbyStateData.selectedCategoryId) {
            setSelectedCategory(lobbyStateData.selectedCategoryId ? String(lobbyStateData.selectedCategoryId) : "");
            setSelectedCategoryName(lobbyStateData.selectedCategoryName ?? "");
            setSelectedDifficulty((lobbyStateData.selectedDifficulty as "easy" | "medium" | "hard" | "") ?? "");
          }
          setResults(lobbyStateData.guesses ?? []);
          setCorrectCount((lobbyStateData.guesses ?? []).filter((guess) => guess.correct).length);
          if ((lobbyStateData.gameStatus ?? "lobby") === "in-progress") {
            setLobbyMessage("");
          }
        }
      } catch {
        if (isMounted) {
          console.log("Could not fetch lobby data");
        }
      }
    };

    void loadLobbyData();
    const intervalId = window.setInterval(() => {
      void loadLobbyData();
    }, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [sessionCode, isCategoryModalOpen]);

  const fetchCategoriesByDifficulty = async (difficulty: "easy" | "medium" | "hard") => {
    setSelectedDifficulty(difficulty);
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
    if (!trimmed || !isCurrentUsersTurn || !selectedCategory) return;

    const isCorrect = validateWord(trimmed);
    setCurrentWord("");

    void fetch(`${API_BASE_URL}/api/games/${sessionCode}/lobby-state/guesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        word: trimmed,
        correct: isCorrect,
        submittedBy: username
      })
    });
  };

  const displayPlayers = Array.from({ length: 4 }, (_, index) => {
    const player = players
      .slice()
      .sort((left, right) => (left.playerOrder ?? 99) - (right.playerOrder ?? 99))[index];

    return player ?? {
      id: `slot-${index + 1}`,
      username: `Player ${index + 1}`,
      score: 0
    };
  });
  const actualPlayers = players
    .slice()
    .sort((left, right) => (left.playerOrder ?? 99) - (right.playerOrder ?? 99));
  const currentUserPlayer = actualPlayers.find((player) => player.username === username);
  const activePlayer = actualPlayers.find((player) => player.playerOrder === currentTurnPlayerOrder);
  const isCurrentUsersTurn =
    gameStatus === "in-progress" &&
    currentUserPlayer?.playerOrder !== undefined &&
    currentUserPlayer.playerOrder === currentTurnPlayerOrder;
  const answersLeft = Math.max(0, roundTargetWordCount - correctCount);
  const readyPlayersCount = actualPlayers.filter((player) => player.isReady).length;
  const canShowStartButton = gameStatus === "lobby" && actualPlayers.length >= 2;
  const hasCurrentUserPressedStart = Boolean(currentUserPlayer?.isReady);
  const turnStatusText =
    gameStatus === "in-progress"
      ? isCurrentUsersTurn
        ? selectedCategoryName
          ? "Your turn is live. Choose words in the selected category."
          : "Your turn is live. Choose a category to begin the round."
        : activePlayer
          ? `${activePlayer.username} is playing right now.`
          : "Waiting for the active player."
      : actualPlayers.length >= 2
        ? `${readyPlayersCount}/${actualPlayers.length} players pressed start game.`
        : "The start button appears when at least 2 players are in the lobby.";

  const handleStartGame = async () => {
    if (!sessionCode || !username || hasCurrentUserPressedStart) {
      return;
    }

    setIsStartingGame(true);
    setLobbyMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/games/${sessionCode}/players/ready`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { message?: string } | null;
        setLobbyMessage(errorBody?.message ?? "Could not update start game status.");
        return;
      }

      setLobbyMessage("You are ready. Waiting for the other players.");
    } finally {
      setIsStartingGame(false);
    }
  };

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
            <article
              className={[
                "sketch-player-slot",
                player.playerOrder === currentTurnPlayerOrder ? "active-turn" : "",
                player.username === username ? "current-user" : ""
              ].filter(Boolean).join(" ")}
              key={player.id ?? index}
            >
              <h2 className="sketch-player-label">{player.username || `Player ${index + 1}`}</h2>
              <div className="sketch-player-score-box">
                <span>{player.score ?? 0}p</span>
              </div>
              {player.playerOrder ? (
                <p className="sketch-player-status">
                  {gameStatus === "in-progress"
                    ? player.playerOrder === currentTurnPlayerOrder
                      ? "Current turn"
                      : "Waiting"
                    : player.isReady
                      ? "Ready"
                      : "Not ready"}
                </p>
              ) : null}
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
                    key={`${result.word}-${result.createdAt}-${index}`}
                  >
                    <span>{result.submittedBy ? `${result.submittedBy}: ${result.word}` : result.word}</span>
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
              <div className="sketch-round-banner">
                <p>Round: {currentRoundNumber > 0 ? currentRoundNumber : "-"}</p>
                <p>Turn: {activePlayer?.username ?? "Waiting..."}</p>
              </div>
              <p className="sketch-turn-status">{turnStatusText}</p>
              {canShowStartButton && (
                <button
                  className="primary"
                  type="button"
                  onClick={() => void handleStartGame()}
                  disabled={isStartingGame || hasCurrentUserPressedStart}
                >
                  {hasCurrentUserPressedStart ? "Waiting for players..." : isStartingGame ? "Starting..." : "Start game"}
                </button>
              )}
              {lobbyMessage && <p className="sketch-lobby-message">{lobbyMessage}</p>}
              <p className="sketch-category-line">
                Category: <span>{selectedCategoryName || "No category selected"}</span>
              </p>
              <button
                className="primary"
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                disabled={!isCurrentUsersTurn}
              >
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
                placeholder={isCurrentUsersTurn ? "Type a word and press Enter" : "Wait for your turn"}
                value={currentWord}
                onChange={(e) => setCurrentWord(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!isCurrentUsersTurn || !selectedCategory}
              />
            </div>

            <div className="sketch-stats-block">
              <p>Correct answers: {correctCount}</p>
              <p>Answer left: {answersLeft}</p>
            </div>
          </section>
        </div>
      </section>

      {isCategoryModalOpen && isCurrentUsersTurn && (
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
                    const nextCategoryId = e.target.value;
                    const nextCategory = categories.find((category) => String(category.id) === nextCategoryId);

                    setSelectedCategory(nextCategoryId);
                    setSelectedCategoryName(nextCategory?.name ?? "");
                    setIsCategoryModalOpen(false);

                    if (!nextCategory) {
                      return;
                    }

                    void fetch(`${API_BASE_URL}/api/games/${sessionCode}/lobby-state/category`, {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                        categoryId: nextCategory.id,
                        categoryName: nextCategory.name,
                        difficulty: selectedDifficulty,
                        selectedBy: username
                      })
                    });
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
