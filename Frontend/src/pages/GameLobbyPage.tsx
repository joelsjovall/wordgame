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

type SubmissionWordResult = {
  originalWord: string;
  normalizedWord: string;
  isValid: boolean;
  isDuplicate: boolean;
  isAccepted: boolean;
};

type RoundSubmissionResponse = {
  roundId: number;
  playerId: number;
  challengeId: number;
  requiredWordCount: number;
  validUniqueWordCount: number;
  succeeded: boolean;
  awardedPoints: number;
  words: SubmissionWordResult[];
};

type RoundResultPlayer = {
  userId: number;
  username: string;
  score: number;
};

type RoundResultChallenge = {
  id: number;
  challengedPlayerId: number;
  requiredWordCount: number;
  status: string;
  validUniqueWordCount: number;
};

type RoundResultsResponse = {
  roundId: number;
  gameId: number;
  category: {
    categoryId: number;
    categoryName: string | null;
    pointsPerWord: number | null;
  };
  players: RoundResultPlayer[];
  challenges: RoundResultChallenge[];
};

type StartRoundResponse = {
  gameId: number;
  roundId: number;
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
  const roundIdFromQuery = Number(queryParams.get("roundId") || queryParams.get("roundid") || "");
  const gameIdFromQuery = Number(queryParams.get("gameId") || queryParams.get("gameid") || "");
  const playerIdFromQuery = Number(queryParams.get("playerId") || "");
  const fallbackGameIdFromCode = Number(sessionCode || "");
  const resolvedGameId = Number.isFinite(gameIdFromQuery) && gameIdFromQuery > 0
    ? gameIdFromQuery
    : (Number.isFinite(fallbackGameIdFromCode) && fallbackGameIdFromCode > 0 ? fallbackGameIdFromCode : 0);

  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"easy" | "medium" | "hard" | "">("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [currentWord, setCurrentWord] = useState("");
  const [results, setResults] = useState<{ word: string; correct: boolean; }[]>([]);
  const [submittedWords, setSubmittedWords] = useState<string[]>([]);
  const [isSubmittingRound, setIsSubmittingRound] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [submissionSummary, setSubmissionSummary] = useState<RoundSubmissionResponse | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResultsResponse | null>(null);
  const [resolvedRoundId, setResolvedRoundId] = useState(
    Number.isFinite(roundIdFromQuery) && roundIdFromQuery > 0 ? roundIdFromQuery : 0
  );

  useEffect(() => {
    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) {
      return;
    }

    fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/players`)
      .then((res) => res.json())
      .then((data) => setPlayers(data))
      .catch(() => console.log("Could not fetch players"));
  }, [resolvedGameId]);

  const resolvedPlayerId = (() => {
    if (playerIdFromQuery > 0) return playerIdFromQuery;
    const matchedPlayer = players.find((player) => String(player.username).toLowerCase() === username.toLowerCase());
    const idAsNumber = Number(matchedPlayer?.id ?? 0);
    return Number.isFinite(idAsNumber) && idAsNumber > 0 ? idAsNumber : 0;
  })();

  useEffect(() => {
    if (resolvedRoundId > 0) return;
    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) return;

    fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/current-round`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Could not resolve current round for this game.");
        }

        const data: { currentRoundId?: number; } = await res.json();
        const currentRoundId = Number(data.currentRoundId ?? 0);

        if (!Number.isFinite(currentRoundId) || currentRoundId <= 0) {
          throw new Error("Game has no active round yet.");
        }

        setResolvedRoundId(currentRoundId);
      })
      .catch(() => {
        // Ignore here. We can still create a round when category is chosen.
      });
  }, [resolvedGameId, resolvedRoundId]);

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

  const fetchRoundResults = async () => {
    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/rounds/${resolvedRoundId}/results`);
      if (!response.ok) {
        return;
      }

      const data: RoundResultsResponse = await response.json();
      setRoundResults(data);
    } catch {
      // Best effort refresh only.
    }
  };

  const createChallengeForRound = async (roundId: number) => {
    if (!Number.isFinite(roundId) || roundId <= 0) return;
    if (resolvedPlayerId <= 0) return;

    const fallbackCallerId = Number(players.find((player) => Number(player.id) !== resolvedPlayerId)?.id ?? resolvedPlayerId);
    const callerPlayerId = Number.isFinite(fallbackCallerId) && fallbackCallerId > 0
      ? fallbackCallerId
      : resolvedPlayerId;

    const response = await fetch(`${API_BASE_URL}/api/rounds/${roundId}/challenges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        challengedPlayerId: resolvedPlayerId,
        callerPlayerId,
        requiredWordCount: 3,
        timeLimitSeconds: 60,
      }),
    });

    // Conflict means there is already an active challenge, which is acceptable.
    if (response.ok || response.status === 409) return;

    const errorBody = await response.text();
    throw new Error(errorBody || "Could not create round challenge.");
  };

  const startRoundForCategory = async (categoryId: number) => {
    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) {
      throw new Error("Missing gameId. Add gameId in the lobby URL.");
    }

    const response = await fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/rounds/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        categoryId,
        currentPlayerId: resolvedPlayerId > 0 ? resolvedPlayerId : null,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || "Could not start round for selected category.");
    }

    const data: StartRoundResponse = await response.json();
    const startedRoundId = Number(data.roundId ?? 0);

    if (!Number.isFinite(startedRoundId) || startedRoundId <= 0) {
      throw new Error("Round start returned an invalid roundId.");
    }

    setResolvedRoundId(startedRoundId);
    await createChallengeForRound(startedRoundId);
    await fetchRoundResults();
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

    setSubmittedWords((prev) => [...prev, trimmed]);
    setCurrentWord("");
  };

  const submitRoundWords = async () => {
    setSubmissionError("");

    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0) {
      setSubmissionError("Missing roundId and no active round could be resolved.");
      return;
    }

    if (resolvedPlayerId <= 0) {
      setSubmissionError("Missing playerId. Add playerId in query string or ensure username matches a player.");
      return;
    }

    if (submittedWords.length === 0) {
      setSubmissionError("Type at least one word before submitting.");
      return;
    }

    setIsSubmittingRound(true);

    try {
      await createChallengeForRound(resolvedRoundId);

      const response = await fetch(`${API_BASE_URL}/api/rounds/${resolvedRoundId}/submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: resolvedPlayerId,
          words: submittedWords,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Could not submit words for this round.");
      }

      const data: RoundSubmissionResponse = await response.json();
      setSubmissionSummary(data);
      setResults(
        data.words.map((word) => ({
          word: word.originalWord,
          correct: word.isAccepted,
        }))
      );
      setSubmittedWords([]);
      await fetchRoundResults();
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Could not submit words for this round."
      );
    } finally {
      setIsSubmittingRound(false);
    }
  };

  const fallbackPlayers: Player[] = [
    { id: "slot-1", username: username || "Player 1", score: 100 },
    { id: "slot-2", username: "Player 2", score: 250 },
    { id: "slot-3", username: "Player 3", score: 123 },
    { id: "slot-4", username: "Player 4", score: 123 },
  ];

  const displayPlayers = players.length ? players.slice(0, 4) : fallbackPlayers;
  const selectedCategoryName = categories.find((category) => String(category.id) === selectedCategory)?.name;
  const correctCount = submissionSummary?.validUniqueWordCount ?? results.filter((result) => result.correct).length;
  const answersLeft = Math.max(0, 10 - correctCount);
  const displayPlayersFromRoundResults = roundResults?.players.map((player) => ({
    id: player.userId,
    username: player.username,
    score: player.score,
  })) ?? [];
  const topPlayers = displayPlayersFromRoundResults.length ? displayPlayersFromRoundResults.slice(0, 4) : displayPlayers;

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
          {topPlayers.map((player, index) => (
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
              <button className="primary" type="button" onClick={() => void submitRoundWords()} disabled={isSubmittingRound}>
                {isSubmittingRound ? "Submitting..." : "Submit round words"}
              </button>
              {submittedWords.length > 0 && (
                <p>
                  Pending words: {submittedWords.join(", ")}
                </p>
              )}
              {submissionError && <p>{submissionError}</p>}
              {submissionSummary && (
                <p>
                  {submissionSummary.succeeded ? "Challenge succeeded." : "Challenge failed."} Awarded points: {submissionSummary.awardedPoints}
                </p>
              )}
            </div>

            <div className="sketch-stats-block">
              {resolvedRoundId > 0 ? <p>Round: {resolvedRoundId}</p> : null}
              <p>Correct answers: {correctCount}</p>
              <p>Answer left: {answersLeft}</p>
              {roundResults?.challenges?.length ? (
                <p>Round challenges tracked: {roundResults.challenges.length}</p>
              ) : null}
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
                  onChange={async (e) => {
                    const categoryId = Number(e.target.value || "");
                    setSelectedCategory(e.target.value);
                    setIsCategoryModalOpen(false);

                    if (!Number.isFinite(categoryId) || categoryId <= 0) {
                      return;
                    }

                    try {
                      setSubmissionError("");
                      await startRoundForCategory(categoryId);
                    } catch (error) {
                      setSubmissionError(
                        error instanceof Error ? error.message : "Could not start a round for this category."
                      );
                    }
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
