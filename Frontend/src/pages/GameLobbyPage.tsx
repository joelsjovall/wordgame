import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type Player = {
  id: number | string;
  username: string;
  score?: number;
  playerOrder?: number;
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

type LiveRoundDraft = {
  playerId: number;
  username: string;
  currentInput: string;
  words: string[];
  updatedAt?: string | null;
};

type LocalResult = {
  word: string;
  correct: boolean;
  submittedBy?: string;
  createdAt?: string;
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
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [currentWord, setCurrentWord] = useState("");
  const [results, setResults] = useState<LocalResult[]>([]);
  const [submittedWords, setSubmittedWords] = useState<string[]>([]);
  const [isSubmittingRound, setIsSubmittingRound] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [submissionSummary, setSubmissionSummary] = useState<RoundSubmissionResponse | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResultsResponse | null>(null);
  const [liveDrafts, setLiveDrafts] = useState<LiveRoundDraft[]>([]);
  const [resolvedRoundId, setResolvedRoundId] = useState(
    Number.isFinite(roundIdFromQuery) && roundIdFromQuery > 0 ? roundIdFromQuery : 0
  );

  const resolvedPlayerId = (() => {
    if (playerIdFromQuery > 0) return playerIdFromQuery;
    const matchedPlayer = players.find((player) => String(player.username).toLowerCase() === username.toLowerCase());
    const idAsNumber = Number(matchedPlayer?.id ?? 0);
    return Number.isFinite(idAsNumber) && idAsNumber > 0 ? idAsNumber : 0;
  })();

  const fetchPlayers = useCallback(async () => {
    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) return;

    const response = await fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/players`);
    if (!response.ok) {
      throw new Error("Could not fetch players");
    }

    const data = (await response.json()) as Player[];
    setPlayers(data);
  }, [resolvedGameId]);

  const fetchCurrentRound = useCallback(async () => {
    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) return 0;

    const response = await fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/current-round`);
    if (!response.ok) {
      return 0;
    }

    const data = (await response.json()) as { currentRoundId?: number; };
    const currentRoundId = Number(data.currentRoundId ?? 0);

    if (Number.isFinite(currentRoundId) && currentRoundId > 0) {
      setResolvedRoundId(currentRoundId);
      return currentRoundId;
    }

    return 0;
  }, [resolvedGameId]);

  const fetchRoundResults = useCallback(async (roundIdOverride?: number) => {
    const roundId = roundIdOverride ?? resolvedRoundId;
    if (!Number.isFinite(roundId) || roundId <= 0) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/rounds/${roundId}/results`);
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as RoundResultsResponse;
      setRoundResults(data);

      if (data.category.categoryName) {
        setSelectedCategoryName(data.category.categoryName);
      }

      if (data.category.categoryId) {
        setSelectedCategory(String(data.category.categoryId));
      }
    } catch {
      // Best effort refresh only.
    }
  }, [resolvedRoundId]);

  const fetchLiveDrafts = useCallback(async (roundIdOverride?: number) => {
    const roundId = roundIdOverride ?? resolvedRoundId;
    if (!Number.isFinite(roundId) || roundId <= 0) {
      setLiveDrafts([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/rounds/${roundId}/drafts`);
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as LiveRoundDraft[];
      setLiveDrafts(Array.isArray(data) ? data : []);
    } catch {
      // Best effort refresh only.
    }
  }, [resolvedRoundId]);

  const syncLiveDraft = useCallback(async (roundId: number, playerId: number, nextCurrentWord: string, nextWords: string[]) => {
    if (!Number.isFinite(roundId) || roundId <= 0 || playerId <= 0) {
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/api/rounds/${roundId}/drafts`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId,
          currentInput: nextCurrentWord,
          words: nextWords,
        }),
      });
    } catch {
      // Keep typing uninterrupted if sync fails transiently.
    }
  }, []);

  useEffect(() => {
    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) {
      return;
    }

    let isMounted = true;

    const loadLobbyState = async () => {
      try {
        await fetchPlayers();
        const currentRoundId = resolvedRoundId > 0 ? resolvedRoundId : await fetchCurrentRound();
        if (currentRoundId > 0) {
          await fetchRoundResults(currentRoundId);
          await fetchLiveDrafts(currentRoundId);
        } else if (isMounted) {
          setLiveDrafts([]);
        }
      } catch {
        if (isMounted) {
          console.log("Could not fetch lobby data");
        }
      }
    };

    void loadLobbyState();
    const intervalId = window.setInterval(() => {
      void loadLobbyState();
    }, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [fetchCurrentRound, fetchLiveDrafts, fetchPlayers, fetchRoundResults, resolvedGameId, resolvedRoundId]);

  useEffect(() => {
    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0 || resolvedPlayerId <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void syncLiveDraft(resolvedRoundId, resolvedPlayerId, currentWord, submittedWords);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentWord, resolvedPlayerId, resolvedRoundId, submittedWords, syncLiveDraft]);

  useEffect(() => {
    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0) {
      return;
    }

    void fetchLiveDrafts(resolvedRoundId);
    const intervalId = window.setInterval(() => {
      void fetchLiveDrafts(resolvedRoundId);
    }, 800);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchLiveDrafts, resolvedRoundId]);

  const fetchCategoriesByDifficulty = async (difficulty: "easy" | "medium" | "hard") => {
    setSelectedDifficulty(difficulty);
    setSelectedCategory("");
    setCategoriesError("");
    setIsCategoriesLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/categories?difficulty=${encodeURIComponent(difficulty)}`);
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Request failed");
      }

      const data = (await response.json()) as CategoriesResponse;
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

    const data = (await response.json()) as StartRoundResponse;
    const startedRoundId = Number(data.roundId ?? 0);

    if (!Number.isFinite(startedRoundId) || startedRoundId <= 0) {
      throw new Error("Round start returned an invalid roundId.");
    }

    const matchedCategory = categories.find((category) => category.id === categoryId);
    setResolvedRoundId(startedRoundId);
    setSelectedCategory(String(categoryId));
    setSelectedCategoryName(matchedCategory?.name ?? selectedCategoryName);
    await createChallengeForRound(startedRoundId);
    await fetchRoundResults(startedRoundId);
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
      setSubmissionError("Missing playerId. Wait for the lobby player list to load and try again.");
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

      const data = (await response.json()) as RoundSubmissionResponse;
      setSubmissionSummary(data);
      setResults(
        data.words.map((word) => ({
          word: word.originalWord,
          correct: word.isAccepted,
          submittedBy: username,
          createdAt: new Date().toISOString(),
        }))
      );
      setSubmittedWords([]);
      setCurrentWord("");
      await fetchRoundResults(resolvedRoundId);
      await fetchLiveDrafts(resolvedRoundId);
      await fetchPlayers();
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Could not submit words for this round."
      );
    } finally {
      setIsSubmittingRound(false);
    }
  };

  const displayPlayers = Array.from({ length: 4 }, (_, index) => {
    const player = players
      .slice()
      .sort((left, right) => (left.playerOrder ?? 99) - (right.playerOrder ?? 99))[index];

    return player ?? {
      id: `slot-${index + 1}`,
      username: `Player ${index + 1}`,
      score: 0,
    };
  });

  const correctCount = submissionSummary?.validUniqueWordCount ?? results.filter((result) => result.correct).length;
  const answersLeft = Math.max(0, 10 - correctCount);
  const displayPlayersFromRoundResults = roundResults?.players.map((player) => ({
    id: player.userId,
    username: player.username,
    score: player.score,
  })) ?? [];
  const topPlayers = displayPlayersFromRoundResults.length ? displayPlayersFromRoundResults.slice(0, 4) : displayPlayers;
  const shownCategoryName = selectedCategoryName || categories.find((category) => String(category.id) === selectedCategory)?.name;
  const liveDraftsByPlayer = displayPlayers.map((player) => {
    const playerId = Number(player.id);
    const draft = liveDrafts.find((candidate) => candidate.playerId === playerId);

    return {
      id: player.id,
      playerId,
      username: player.username,
      currentInput: draft?.currentInput ?? "",
      words: draft?.words ?? [],
      isYou: playerId === resolvedPlayerId,
    };
  });

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
                    key={`${result.word}-${result.createdAt ?? index}-${index}`}
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
              <p className="sketch-category-line">
                Category: <span>{shownCategoryName ?? "Category_name"}</span>
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

            <div className="sketch-live-board">
              <h3 className="sketch-live-title">Live answers</h3>
              <div className="sketch-live-grid">
                {liveDraftsByPlayer.map((draftPlayer, index) => (
                  <article className="sketch-live-card" key={draftPlayer.id ?? index}>
                    <p className="sketch-live-player">
                      {draftPlayer.username || `Player ${index + 1}`}{draftPlayer.isYou ? " (you)" : ""}
                    </p>
                    {draftPlayer.words.length > 0 ? (
                      <p className="sketch-live-words">{draftPlayer.words.join(", ")}</p>
                    ) : (
                      <p className="sketch-live-empty">No shared answers yet</p>
                    )}
                    {draftPlayer.currentInput.trim() ? (
                      <p className="sketch-live-typing">Typing: {draftPlayer.currentInput}</p>
                    ) : null}
                  </article>
                ))}
              </div>
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
