import { useCallback, useEffect, useState } from "react";
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

type SubmissionWordResult = {
  originalWord: string;
  normalizedWord: string;
  isValid: boolean;
  isDuplicate: boolean;
  isAccepted: boolean;
};

type ValidateWordResponse = SubmissionWordResult;

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
  turnOrder: number;
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
  roundNumber: number;
  status: string;
  currentPlayerId: number | null;
  currentPlayerName: string | null;
  deadlineUtc: string | null;
  secondsRemaining: number | null;
  highestBidCount: number | null;
  highestBidPlayerId: number | null;
  highestBidPlayerName: string | null;
  category: {
    categoryId: number;
    categoryName: string | null;
    pointsPerWord: number | null;
  };
  players: RoundResultPlayer[];
  challenges: RoundResultChallenge[];
};

type GameStateResponse = {
  gameId: number;
  currentRoundId: number | null;
  phase: string;
  activePlayerId: number | null;
  activePlayerName: string | null;
  deadlineUtc: string | null;
  secondsRemaining: number | null;
  readyPlayerIds: number[];
  readyPlayersCount: number;
  totalPlayers: number;
  allPlayersReady: boolean;
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
  correct?: boolean;
  pending?: boolean;
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
  const [currentBidCount, setCurrentBidCount] = useState("");
  const [results, setResults] = useState<LocalResult[]>([]);
  const [submittedWords, setSubmittedWords] = useState<string[]>([]);
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [isCallingBluff, setIsCallingBluff] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [submissionSummary, setSubmissionSummary] = useState<RoundSubmissionResponse | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResultsResponse | null>(null);
  const [gameState, setGameState] = useState<GameStateResponse | null>(null);
  const [liveDrafts, setLiveDrafts] = useState<LiveRoundDraft[]>([]);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
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

  const fetchGameState = useCallback(async () => {
    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) return null;

    const response = await fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/state`);
    if (!response.ok) {
      throw new Error("Could not fetch game state");
    }

    const data = (await response.json()) as GameStateResponse;
    setGameState(data);

    const currentRoundId = Number(data.currentRoundId ?? 0);
    if (Number.isFinite(currentRoundId) && currentRoundId > 0) {
      setResolvedRoundId(currentRoundId);
    }

    return data;
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
        setLiveDrafts([]);
        return;
      }

      const data = (await response.json()) as LiveRoundDraft[];
      setLiveDrafts(Array.isArray(data) ? data : []);
    } catch {
      setLiveDrafts([]);
    }
  }, [resolvedRoundId]);

  const syncLiveDraft = useCallback(async (roundId: number, playerId: number, nextCurrentInput: string, nextWords: string[]) => {
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
          currentInput: nextCurrentInput,
          words: nextWords,
        }),
      });
    } catch {
      // Best effort only while typing.
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
        const state = await fetchGameState();
        const currentRoundId = state?.currentRoundId && state.currentRoundId > 0
          ? state.currentRoundId
          : (resolvedRoundId > 0 ? resolvedRoundId : await fetchCurrentRound());
        if (currentRoundId > 0) {
          await fetchRoundResults(currentRoundId);
          await fetchLiveDrafts(currentRoundId);
        } else {
          setRoundResults(null);
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
  }, [fetchCurrentRound, fetchGameState, fetchLiveDrafts, fetchPlayers, fetchRoundResults, resolvedGameId, resolvedRoundId]);

  useEffect(() => {
    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0) {
      setLiveDrafts([]);
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

  useEffect(() => {
    const nextSecondsRemaining = roundResults?.secondsRemaining ?? gameState?.secondsRemaining ?? null;
    if (nextSecondsRemaining === null || nextSecondsRemaining === undefined) {
      setCountdownSeconds(null);
      return;
    }

    setCountdownSeconds(nextSecondsRemaining);
    const intervalId = window.setInterval(() => {
      setCountdownSeconds((previous) => {
        if (previous === null) return null;
        return Math.max(0, previous - 1);
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [gameState?.secondsRemaining, roundResults?.secondsRemaining]);

  useEffect(() => {
    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0 || resolvedPlayerId <= 0) {
      return;
    }

    const existingLiveDraft = liveDrafts.find((draft) => draft.playerId === resolvedPlayerId);
    if (submittedWords.length === 0 && !currentWord.trim() && !existingLiveDraft) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void syncLiveDraft(resolvedRoundId, resolvedPlayerId, currentWord, submittedWords);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentWord, liveDrafts, resolvedPlayerId, resolvedRoundId, submittedWords, syncLiveDraft]);

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

  const startRoundForCategory = async (categoryId: number, bidCount: number) => {
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
        openingBidCount: bidCount,
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
    setCurrentBidCount("");
    setSubmittedWords([]);
    setResults([]);
    setSubmissionSummary(null);
    setLiveDrafts([]);
    await fetchGameState();
    await fetchRoundResults(startedRoundId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submitWord();
    }
  };

  const markPlayerReady = async () => {
    setSubmissionError("");

    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0 || resolvedPlayerId <= 0) {
      setSubmissionError("Missing game or player information.");
      return;
    }

    setIsMarkingReady(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/ready`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: resolvedPlayerId,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Could not mark player as ready.");
      }

      await fetchPlayers();
      await fetchGameState();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not mark player as ready.");
    } finally {
      setIsMarkingReady(false);
    }
  };

  const submitWord = async () => {
    const trimmed = currentWord.trim();
    if (!trimmed) return;

    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0) {
      setSubmissionError("Missing roundId and no active round could be resolved.");
      return;
    }

    if (resolvedPlayerId <= 0) {
      setSubmissionError("Missing playerId. Wait for the lobby player list to load and try again.");
      return;
    }

    const createdAt = new Date().toISOString();
    setCurrentWord("");
    setResults((prev) => [
      ...prev,
      {
        word: trimmed,
        pending: true,
        submittedBy: username,
        createdAt,
      },
    ]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/rounds/${resolvedRoundId}/validate-word`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: resolvedPlayerId,
          word: trimmed,
          existingWords: submittedWords,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Could not validate word.");
      }

      const data = (await response.json()) as ValidateWordResponse;

      setResults((prev) =>
        prev.map((result) =>
          result.createdAt === createdAt && result.word === trimmed && result.pending
            ? {
                ...result,
                word: data.originalWord,
                correct: data.isAccepted,
                pending: false,
              }
            : result
        )
      );

      if (data.isAccepted) {
        setSubmittedWords((prev) => [...prev, trimmed]);
      }
      setSubmissionError("");
    } catch (error) {
      setResults((prev) =>
        prev.map((result) =>
          result.createdAt === createdAt && result.word === trimmed && result.pending
            ? {
                ...result,
                correct: false,
                pending: false,
              }
            : result
        )
      );
      setSubmissionError(error instanceof Error ? error.message : "Could not validate word.");
    }
  };

  const submitBid = async () => {
    setSubmissionError("");

    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0) {
      setSubmissionError("There is no active round to bid in.");
      return;
    }

    if (resolvedPlayerId <= 0) {
      setSubmissionError("Missing playerId. Wait for the lobby player list to load and try again.");
      return;
    }

    const bidCount = Number(currentBidCount);
    if (!Number.isFinite(bidCount) || bidCount <= 0) {
      setSubmissionError("Enter a valid number before placing a bid.");
      return;
    }

    setIsSubmittingBid(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/rounds/${resolvedRoundId}/bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: resolvedPlayerId,
          bidCount,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Could not place bid.");
      }

      setCurrentBidCount("");
      await fetchGameState();
      await fetchRoundResults(resolvedRoundId);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not place bid.");
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const callBluff = async () => {
    setSubmissionError("");

    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0 || !roundResults) {
      setSubmissionError("There is no bid to challenge.");
      return;
    }

    if (resolvedPlayerId <= 0) {
      setSubmissionError("Missing playerId. Wait for the lobby player list to load and try again.");
      return;
    }

    if (!roundResults.highestBidPlayerId || !roundResults.highestBidCount) {
      setSubmissionError("There is no active bid to challenge yet.");
      return;
    }

    setIsCallingBluff(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/rounds/${resolvedRoundId}/challenges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callerPlayerId: resolvedPlayerId,
          challengedPlayerId: roundResults.highestBidPlayerId,
          requiredWordCount: roundResults.highestBidCount,
          timeLimitSeconds: 60,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Could not challenge this bid.");
      }

      setSubmittedWords([]);
      setResults([]);
      setSubmissionSummary(null);
      setCurrentWord("");
      setLiveDrafts([]);
      await fetchGameState();
      await fetchRoundResults(resolvedRoundId);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not challenge this bid.");
    } finally {
      setIsCallingBluff(false);
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

  const displayPlayersFromRoundResults = roundResults?.players.map((player) => ({
    id: player.userId,
    username: player.username,
    score: player.score,
    playerOrder: player.turnOrder,
  })) ?? [];
  const topPlayers = displayPlayersFromRoundResults.length ? displayPlayersFromRoundResults.slice(0, 4) : displayPlayers;
  const shownCategoryName = selectedCategoryName || categories.find((category) => String(category.id) === selectedCategory)?.name;
  const firstPlayerId = players
    .slice()
    .sort((left, right) => (left.playerOrder ?? 99) - (right.playerOrder ?? 99))[0]?.id;
  const firstPlayerIdAsNumber = Number(firstPlayerId ?? 0);
  const currentPhase = gameState?.phase ?? roundResults?.status ?? "waiting";
  const roundStatus = roundResults?.status ?? currentPhase;
  const activePlayerId = gameState?.activePlayerId ?? roundResults?.currentPlayerId ?? null;
  const highestBidCount = roundResults?.highestBidCount ?? null;
  const highestBidPlayerName = roundResults?.highestBidPlayerName ?? null;
  const currentTurnPlayerName = gameState?.activePlayerName ?? roundResults?.currentPlayerName ?? null;
  const readyPlayerIds = new Set(gameState?.readyPlayerIds ?? []);
  const liveDraftsByPlayerId = new Map(liveDrafts.map((draft) => [draft.playerId, draft]));
  const isMyTurn = resolvedPlayerId > 0 && activePlayerId === resolvedPlayerId;
  const isRoundStartPending = currentPhase === "round_start_pending";
  const amIReady = readyPlayerIds.has(resolvedPlayerId);
  const canChooseCategory = resolvedPlayerId > 0 && (
    (currentPhase === "category_selection" && isMyTurn) ||
    (!gameState && !roundResults && Number.isFinite(firstPlayerIdAsNumber) && firstPlayerIdAsNumber > 0 && firstPlayerIdAsNumber === resolvedPlayerId)
  );
  const canBid = roundStatus === "bidding" && isMyTurn;
  const canChallenge = canBid && !!highestBidCount && roundResults?.highestBidPlayerId !== resolvedPlayerId;
  const canSubmitWords = roundStatus === "challenge_active" && isMyTurn;
  const canSetOpeningBid = canChooseCategory && !!selectedCategory;
  const correctCount = canSubmitWords
    ? submittedWords.length
    : (submissionSummary?.validUniqueWordCount ?? results.filter((result) => result.correct).length);
  const answersLeft = Math.max(0, 10 - correctCount);
  const wordsLeftToType = Math.max(0, (highestBidCount ?? 0) - submittedWords.length);
  const roundMessage = isRoundStartPending
    ? (amIReady
      ? `Waiting for everyone to click Starta rundan (${gameState?.readyPlayersCount ?? 0}/${gameState?.totalPlayers ?? players.length}).`
      : "Click Starta rundan when you are ready for the next round.")
    : canChooseCategory
      ? "Your turn to choose category and set the first bid."
      : roundStatus === "bidding"
        ? (isMyTurn
          ? (highestBidCount ? "Your turn. Raise the bid or challenge the previous player." : "Your turn to open the bidding.")
          : `${currentTurnPlayerName ?? "Another player"} is deciding the next move.`)
        : roundStatus === "challenge_active"
          ? (canSubmitWords
            ? `Your turn to write ${highestBidCount ?? 0} words in this category before time runs out.`
            : `${currentTurnPlayerName ?? "Another player"} is writing their words now.`)
          : roundResults?.status === "completed"
            ? `${currentTurnPlayerName ?? "Next player"} starts the next round.`
            : "Waiting for the first round to start.";
  const timerLabel = currentPhase === "category_selection"
    ? "Time to choose category and opening bid"
    : currentPhase === "round_start_pending"
      ? "Waiting for players"
      : roundStatus === "bidding"
        ? "Time to answer the bid"
        : roundStatus === "challenge_active"
          ? "Time to write words"
          : "Time";
  const liveDraftCards = topPlayers.map((player, index) => {
    const playerId = Number(player.id);
    const liveDraft = liveDraftsByPlayerId.get(playerId);

    return {
      id: player.id ?? index,
      username: player.username || `Player ${index + 1}`,
      currentInput: liveDraft?.currentInput ?? "",
      words: liveDraft?.words ?? [],
      isYou: playerId > 0 && playerId === resolvedPlayerId,
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
            <article
              className={`sketch-player-slot${Number(player.id) === activePlayerId ? " active-turn" : ""}${Number(player.id) === resolvedPlayerId ? " current-user" : ""}`}
              key={player.id ?? index}
            >
              <h2 className="sketch-player-label">{player.username || `Player ${index + 1}`}</h2>
              <div className="sketch-player-score-box">
                <span>{player.score ?? 0}p</span>
              </div>
              <p className="sketch-player-status">
                {Number(player.id) === activePlayerId
                  ? "Current turn"
                  : readyPlayerIds.has(Number(player.id))
                    ? "Ready"
                    : Number(player.id) === resolvedPlayerId
                      ? "You"
                      : `Player ${player.playerOrder ?? index + 1}`}
              </p>
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
                    className={result.pending ? "sketch-history-item" : result.correct ? "sketch-history-item correct" : "sketch-history-item incorrect"}
                    key={`${result.word}-${result.createdAt ?? index}-${index}`}
                  >
                    <span>{result.submittedBy ? `${result.submittedBy}: ${result.word}` : result.word}</span>
                    <span>{result.pending ? "Checking..." : result.correct ? "Correct" : "Incorrect"}</span>
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
                <p>Round: {roundResults?.roundNumber ?? 0}</p>
                <p>Status: {currentPhase}</p>
                {countdownSeconds !== null ? <p>{timerLabel}: {countdownSeconds}s</p> : null}
              </div>
              <p className="sketch-turn-status">{roundMessage}</p>
              {isRoundStartPending ? (
                <button className="primary" type="button" onClick={() => void markPlayerReady()} disabled={amIReady || isMarkingReady}>
                  {isMarkingReady ? "Starting..." : amIReady ? "Ready" : "Starta rundan"}
                </button>
              ) : null}
              <p className="sketch-category-line">
                Category: <span>{shownCategoryName ?? "Category_name"}</span>
              </p>
              <button
                className="primary"
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                disabled={!canChooseCategory}
              >
                Choose category
              </button>
              {selectedDifficulty && <p className="sketch-difficulty">Difficulty: {selectedDifficulty}</p>}
              {canChooseCategory && selectedCategoryName ? (
                <p className="sketch-lobby-message">Selected category: {selectedCategoryName}</p>
              ) : null}
              {highestBidCount ? (
                <p className="sketch-lobby-message">
                  Highest bid: {highestBidCount} by {highestBidPlayerName ?? "Unknown player"}
                </p>
              ) : null}
            </div>

            <div className="sketch-word-block">
              <label className="sketch-word-label" htmlFor="bid-input">
                Bid count
              </label>
              <input
                id="bid-input"
                className="sketch-word-input"
                type="number"
                min="1"
                placeholder={canChooseCategory ? "Set opening bid" : highestBidCount ? `More than ${highestBidCount}` : "How many can you name?"}
                value={currentBidCount}
                onChange={(e) => setCurrentBidCount(e.target.value)}
                disabled={(!canBid && !canSetOpeningBid) || isSubmittingBid}
              />
              <div className="sketch-action-row">
                <button
                  className="primary"
                  type="button"
                  onClick={() => {
                    if (canChooseCategory) {
                      const categoryId = Number(selectedCategory || "");
                      const bidCount = Number(currentBidCount || "");

                      if (!Number.isFinite(categoryId) || categoryId <= 0) {
                        setSubmissionError("Choose a category first.");
                        return;
                      }

                      if (!Number.isFinite(bidCount) || bidCount <= 0) {
                        setSubmissionError("Write a valid opening bid first.");
                        return;
                      }

                      void startRoundForCategory(categoryId, bidCount).catch((error: unknown) => {
                        setSubmissionError(
                          error instanceof Error ? error.message : "Could not start a round for this category."
                        );
                      });
                      return;
                    }

                    void submitBid();
                  }}
                  disabled={(!canBid && !canSetOpeningBid) || isSubmittingBid}
                >
                  {isSubmittingBid ? "Saving bid..." : canChooseCategory ? "Start round" : highestBidCount ? "I can name more" : "Set opening bid"}
                </button>
                <button className="primary" type="button" onClick={() => void callBluff()} disabled={!canChallenge || isCallingBluff}>
                  {isCallingBluff ? "Checking..." : "Bullshit"}
                </button>
              </div>

              <label className="sketch-word-label" htmlFor="word-input">
                S kriv orden här
              </label>
              <input
                id="word-input"
                className="sketch-word-input"
                type="text"
                placeholder="Type a word and press Enter"
                value={currentWord}
                onChange={(e) => setCurrentWord(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!canSubmitWords}
              />
              {submittedWords.length > 0 && (
                <p>
                  Accepted words: {submittedWords.join(", ")}
                </p>
              )}
              {canSubmitWords ? <p>Words left to type: {wordsLeftToType}</p> : null}
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
                {liveDraftCards.map((draft) => (
                  <article className="sketch-live-card" key={draft.id}>
                    <p className="sketch-live-player">{draft.username}{draft.isYou ? " (you)" : ""}</p>
                    {draft.words.length > 0 ? (
                      <p className="sketch-live-words">{draft.words.join(", ")}</p>
                    ) : (
                      <p className="sketch-live-empty">No accepted words shared yet</p>
                    )}
                    {draft.currentInput.trim() ? (
                      <p className="sketch-live-typing">Typing: {draft.currentInput}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>

            <div className="sketch-stats-block">
              {resolvedRoundId > 0 ? <p>Round: {resolvedRoundId}</p> : null}
              <p>Correct answers: {correctCount}</p>
              <p>Answer left: {answersLeft}</p>
              {currentTurnPlayerName ? <p>Current player: {currentTurnPlayerName}</p> : null}
              {roundResults?.challenges?.length ? (
                <p>Round challenges tracked: {roundResults.challenges.length}</p>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      {isCategoryModalOpen && canChooseCategory && (
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
                    const categoryId = Number(e.target.value || "");
                    setSelectedCategory(e.target.value);
                    const matchedCategory = categories.find((category) => category.id === categoryId);
                    setSelectedCategoryName(matchedCategory?.name ?? "");
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
