import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../utils/apiBaseUrl";

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
type ExtendedValidateWordResponse = ValidateWordResponse & {
  validUniqueWordCount?: number;
  requiredWordCount?: number;
  challengeCompleted?: boolean;
  challengeSucceeded?: boolean | null;
  awardedPoints?: number | null;
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
  roundNumber?: number | null;
  phase: string;
  activePlayerId: number | null;
  activePlayerName: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  highestBidCount?: number | null;
  highestBidPlayerId?: number | null;
  highestBidPlayerName?: string | null;
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
  roundNumber?: number;
  categoryId?: number;
  status?: string;
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

const difficultyOptions: { key: "easy" | "medium" | "hard"; label: string; points: number; }[] = [
  { key: "easy", label: "Easy", points: 1 },
  { key: "medium", label: "Medium", points: 2 },
  { key: "hard", label: "Hard", points: 3 },
];

const previewPlayers: Player[] = [
  { id: 1, username: "joellll111", score: 12, playerOrder: 1, isReady: false },
  { id: 2, username: "Maja", score: 9, playerOrder: 2, isReady: true },
  { id: 3, username: "Alex", score: 7, playerOrder: 3, isReady: false },
  { id: 4, username: "Sam", score: 5, playerOrder: 4, isReady: false },
];

const previewCategories: Category[] = [
  { id: 11, name: "European capitals", difficulty: "easy", points: 1 },
  { id: 12, name: "Active car brands", difficulty: "medium", points: 2 },
  { id: 13, name: "World Cup 2026 teams", difficulty: "hard", points: 3 },
];

const previewValidWordsByCategoryId: Record<number, string[]> = {
  11: ["stockholm", "oslo", "copenhagen", "helsinki", "paris", "berlin", "madrid", "rome", "lisbon", "vienna"],
  12: ["volvo", "bmw", "saab", "ferrari", "bugatti", "toyota", "ford", "honda", "audi", "mercedes", "tesla"],
  13: ["sweden", "england", "france", "brazil", "argentina", "japan", "germany", "spain", "portugal", "usa"],
};

const previewGameState: GameStateResponse = {
  gameId: 121,
  currentRoundId: 77,
  roundNumber: 3,
  phase: "category_selection",
  activePlayerId: 1,
  activePlayerName: "joellll111",
  categoryId: 12,
  categoryName: "Active car brands",
  highestBidCount: 4,
  highestBidPlayerId: 2,
  highestBidPlayerName: "Maja",
  deadlineUtc: null,
  secondsRemaining: 44,
  readyPlayerIds: [2],
  readyPlayersCount: 1,
  totalPlayers: 4,
  allPlayersReady: false,
};

const previewRoundResults: RoundResultsResponse = {
  roundId: 77,
  gameId: 121,
  roundNumber: 3,
  status: "category_selection",
  currentPlayerId: 1,
  currentPlayerName: "joellll111",
  deadlineUtc: null,
  secondsRemaining: 44,
  highestBidCount: 4,
  highestBidPlayerId: 2,
  highestBidPlayerName: "Maja",
  category: {
    categoryId: 12,
    categoryName: "Active car brands",
    pointsPerWord: 2,
  },
  players: previewPlayers.map((player) => ({
    userId: Number(player.id),
    username: player.username,
    score: player.score ?? 0,
    turnOrder: player.playerOrder ?? 0,
  })),
  challenges: [],
};

const previewLiveDrafts: LiveRoundDraft[] = [
  { playerId: 1, username: "joellll111", currentInput: "mer", words: ["Volvo", "BMW"] },
  { playerId: 2, username: "Maja", currentInput: "", words: ["Saab"] },
  { playerId: 3, username: "Alex", currentInput: "Aud", words: [] },
];

const previewResults: LocalResult[] = [
  { word: "Volvo", correct: true, submittedBy: "joellll111" },
  { word: "Ferrari", correct: false, submittedBy: "Maja" },
];

const LOBBY_POLL_INTERVAL_MS = 2000;
const LOBBY_FALLBACK_POLL_INTERVAL_MS = 10000;

function GameLobbyPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const isPreviewMode = queryParams.get("preview") === "1";
  const previewState = queryParams.get("previewState") || queryParams.get("state") || "";
  const isPreviewWritingWords = isPreviewMode && ["write", "writing", "challenge", "challenge_active"].includes(previewState);

  const sessionCode = queryParams.get("code") || (isPreviewMode ? "121" : "");
  const username = queryParams.get("user") || (isPreviewMode ? "joellll111" : "");
  const roundIdFromQuery = Number(queryParams.get("roundId") || queryParams.get("roundid") || (isPreviewMode ? "77" : ""));
  const gameIdFromQuery = Number(queryParams.get("gameId") || queryParams.get("gameid") || (isPreviewMode ? "121" : ""));
  const playerIdFromQuery = Number(queryParams.get("playerId") || (isPreviewMode ? "1" : ""));
  const fallbackGameIdFromCode = Number(sessionCode || "");
  const resolvedGameId = Number.isFinite(gameIdFromQuery) && gameIdFromQuery > 0
    ? gameIdFromQuery
    : (Number.isFinite(fallbackGameIdFromCode) && fallbackGameIdFromCode > 0 ? fallbackGameIdFromCode : 0);

  const [players, setPlayers] = useState<Player[]>(isPreviewMode ? previewPlayers : []);
  const [categories, setCategories] = useState<Category[]>(isPreviewMode ? previewCategories : []);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"easy" | "medium" | "hard" | "">("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(isPreviewMode);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [currentWord, setCurrentWord] = useState("");
  const [currentBidCount, setCurrentBidCount] = useState("");
  const [results, setResults] = useState<LocalResult[]>(isPreviewMode ? previewResults : []);
  const [submittedWords, setSubmittedWords] = useState<string[]>([]);
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [isCallingBluff, setIsCallingBluff] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [submissionSummary, setSubmissionSummary] = useState<RoundSubmissionResponse | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResultsResponse | null>(isPreviewMode
    ? {
      ...previewRoundResults,
      status: isPreviewWritingWords ? "challenge_active" : previewRoundResults.status,
      currentPlayerId: isPreviewWritingWords ? 1 : previewRoundResults.currentPlayerId,
      currentPlayerName: isPreviewWritingWords ? "joellll111" : previewRoundResults.currentPlayerName,
      deadlineUtc: previewRoundResults.deadlineUtc,
      secondsRemaining: isPreviewWritingWords ? 44 : previewRoundResults.secondsRemaining,
    }
    : null);
  const [gameState, setGameState] = useState<GameStateResponse | null>(isPreviewMode
    ? {
      ...previewGameState,
      phase: isPreviewWritingWords ? "challenge_active" : previewGameState.phase,
      activePlayerId: isPreviewWritingWords ? 1 : previewGameState.activePlayerId,
      activePlayerName: isPreviewWritingWords ? "joellll111" : previewGameState.activePlayerName,
      deadlineUtc: previewGameState.deadlineUtc,
      secondsRemaining: isPreviewWritingWords ? 44 : previewGameState.secondsRemaining,
    }
    : null);
  const [liveDrafts, setLiveDrafts] = useState<LiveRoundDraft[]>(isPreviewMode ? previewLiveDrafts : []);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(isPreviewMode ? previewGameState.secondsRemaining : null);
  const [resolvedRoundId, setResolvedRoundId] = useState(
    Number.isFinite(roundIdFromQuery) && roundIdFromQuery > 0 ? roundIdFromQuery : 0
  );
  const currentRoundIdFromGameState = Number(gameState?.currentRoundId ?? 0);
  const isLobbyRefreshInFlight = useRef(false);
  const previousPhaseRef = useRef<string>("");

  const resetRoundUiState = (options?: { clearSelection?: boolean; clearRoundResults?: boolean; }) => {
    setCurrentWord("");
    setCurrentBidCount("");
    setSubmittedWords([]);
    setResults([]);
    setSubmissionSummary(null);
    setLiveDrafts([]);
    setSubmissionError("");

    if (options?.clearSelection) {
      setSelectedCategory("");
      setSelectedCategoryName("");
      setSelectedDifficulty("");
      setIsCategoryModalOpen(false);
    }

    if (options?.clearRoundResults) {
      setRoundResults(null);
    }
  };

  useEffect(() => {
    const nextResolvedRoundId = Number.isFinite(currentRoundIdFromGameState) && currentRoundIdFromGameState > 0
      ? currentRoundIdFromGameState
      : null;

    if (nextResolvedRoundId === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setResolvedRoundId((previousRoundId) =>
        previousRoundId === nextResolvedRoundId
          ? previousRoundId
          : (resetRoundUiState({ clearRoundResults: true }), nextResolvedRoundId)
      );
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentRoundIdFromGameState]);


  const resolvedPlayerId = (() => {
    if (playerIdFromQuery > 0) return playerIdFromQuery;
    const matchedPlayer = players.find((player) => String(player.username).toLowerCase() === username.toLowerCase());
    const idAsNumber = Number(matchedPlayer?.id ?? 0);
    return Number.isFinite(idAsNumber) && idAsNumber > 0 ? idAsNumber : 0;
  })();

  const getNextPlayerId = (currentPlayerId: number) => {
    const orderedPlayers = players
      .map((player) => ({
        userId: Number(player.id),
        playerOrder: player.playerOrder ?? 99,
      }))
      .filter((player) => Number.isFinite(player.userId) && player.userId > 0)
      .sort((left, right) => left.playerOrder - right.playerOrder);

    if (orderedPlayers.length === 0) {
      return null;
    }

    const currentIndex = orderedPlayers.findIndex((player) => player.userId === currentPlayerId);
    if (currentIndex < 0) {
      return orderedPlayers[0].userId;
    }

    return orderedPlayers[(currentIndex + 1) % orderedPlayers.length]?.userId ?? orderedPlayers[0].userId;
  };

  const getPlayerName = (playerId: number | null | undefined) => {
    if (!playerId) {
      return null;
    }

    return players.find((player) => Number(player.id) === playerId)?.username ?? null;
  };

  const buildOptimisticRoundResults = (
    roundId: number,
    status: string,
    overrides?: Partial<RoundResultsResponse>
  ): RoundResultsResponse => ({
    roundId,
    gameId: resolvedGameId,
    roundNumber: overrides?.roundNumber ?? roundResults?.roundNumber ?? 1,
    status,
    currentPlayerId: overrides?.currentPlayerId ?? null,
    currentPlayerName: overrides?.currentPlayerName ?? null,
    deadlineUtc: overrides?.deadlineUtc ?? null,
    secondsRemaining: overrides?.secondsRemaining ?? null,
    highestBidCount: overrides?.highestBidCount ?? null,
    highestBidPlayerId: overrides?.highestBidPlayerId ?? null,
    highestBidPlayerName: overrides?.highestBidPlayerName ?? null,
    category: overrides?.category ?? {
      categoryId: Number(selectedCategory || 0),
      categoryName: selectedCategoryName || null,
      pointsPerWord: roundResults?.category.pointsPerWord ?? null,
    },
    players: overrides?.players ?? players
      .map((player) => ({
        userId: Number(player.id),
        username: player.username,
        score: player.score ?? 0,
        turnOrder: player.playerOrder ?? 99,
      }))
      .filter((player) => Number.isFinite(player.userId) && player.userId > 0),
    challenges: overrides?.challenges ?? [],
  });

  const fetchPlayers = async () => {
    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) return;

    const response = await fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/players`);
    if (!response.ok) {
      throw new Error("Could not fetch players");
    }

    const data = (await response.json()) as Player[];
    setPlayers(data);
  };

  const fetchGameState = async () => {
    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) return null;

    const response = await fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/state`);
    if (!response.ok) {
      throw new Error("Could not fetch game state");
    }

    const data = (await response.json()) as GameStateResponse;
    setGameState(data);
    setCountdownSeconds(data.secondsRemaining ?? null);

    const currentRoundId = Number(data.currentRoundId ?? 0);
    if (Number.isFinite(currentRoundId) && currentRoundId > 0) {
      setResolvedRoundId((previousRoundId) =>
        previousRoundId === currentRoundId
          ? previousRoundId
          : (resetRoundUiState({ clearRoundResults: true }), currentRoundId)
      );
    }

    return data;
  };

  const fetchRoundResults = async (roundIdOverride?: number) => {
    const roundId = roundIdOverride ?? resolvedRoundId;
    if (!Number.isFinite(roundId) || roundId <= 0) {
      setRoundResults(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/rounds/${roundId}/results`);
      if (!response.ok) {
        setRoundResults(null);
        return;
      }

      const data = await response.json() as RoundResultsResponse;

      setRoundResults(data);
    } catch {
      setRoundResults(null);
    }
  };
  useEffect(() => {
    if (isPreviewMode) {
      return;
    }

    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) {
      return;
    }

    let isMounted = true;

    const loadRoundResults = async (roundId: number) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rounds/${roundId}/results`);
        if (!response.ok) {
          if (isMounted) {
            setRoundResults(null);
          }
          return;
        }

        const data = await response.json() as RoundResultsResponse;
        if (!isMounted) return;

        setRoundResults(data);
      } catch {
        if (isMounted) {
          setRoundResults(null);
        }
      }
    };

    const loadLiveDrafts = async (roundId: number) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rounds/${roundId}/drafts`);
        if (!response.ok) {
          if (isMounted) {
            setLiveDrafts([]);
          }
          return;
        }

        const data = (await response.json()) as LiveRoundDraft[];
        if (!isMounted) return;
        setLiveDrafts(Array.isArray(data) ? data : []);
      } catch {
        if (isMounted) {
          setLiveDrafts([]);
        }
      }
    };

    const loadLobbyState = async () => {
      if (isLobbyRefreshInFlight.current) {
        return;
      }

      isLobbyRefreshInFlight.current = true;

      try {
        const [playersResponse, stateResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/players`),
          fetch(`${API_BASE_URL}/api/games/${resolvedGameId}/state`),
        ]);

        if (!playersResponse.ok) {
          throw new Error("Could not fetch players");
        }

        if (!stateResponse.ok) {
          throw new Error("Could not fetch game state");
        }

        const playersData = (await playersResponse.json()) as Player[];
        const state = (await stateResponse.json()) as GameStateResponse;
        if (!isMounted) return;

        setPlayers(playersData);
        setGameState(state);
        setCountdownSeconds(state.secondsRemaining ?? null);

        const stateRoundId = Number(state.currentRoundId ?? 0);
        if (Number.isFinite(stateRoundId) && stateRoundId > 0) {
          setResolvedRoundId((previousRoundId) =>
            previousRoundId === stateRoundId
              ? previousRoundId
          : (resetRoundUiState({ clearRoundResults: true }), stateRoundId)
      );
        }

        const currentRoundId = stateRoundId;

        if (currentRoundId > 0) {
          if (state.phase !== "round_start_pending" && state.phase !== "category_selection") {
            void loadRoundResults(currentRoundId);
          }

          if (state.phase === "challenge_active") {
            void loadLiveDrafts(currentRoundId);
          } else {
            setLiveDrafts([]);
          }
        } else {
          setRoundResults(null);
          setLiveDrafts([]);
        }
      } catch {
        if (isMounted) {
          console.log("Could not fetch lobby data");
        }
      } finally {
        isLobbyRefreshInFlight.current = false;
      }
    };

    void loadLobbyState();
    const eventSource = typeof EventSource === "undefined"
      ? null
      : new EventSource(`${API_BASE_URL}/api/games/${resolvedGameId}/events`);

    eventSource?.addEventListener("game-updated", () => {
      void loadLobbyState();
    });

    const intervalId = window.setInterval(() => {
      void loadLobbyState();
    }, eventSource ? LOBBY_FALLBACK_POLL_INTERVAL_MS : LOBBY_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      isLobbyRefreshInFlight.current = false;
      eventSource?.close();
      window.clearInterval(intervalId);
    };
  }, [isPreviewMode, resolvedGameId]);

  const hasActiveCountdown = countdownSeconds !== null;

  useEffect(() => {
    if (!hasActiveCountdown) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCountdownSeconds((previous) => {
        if (previous === null) {
          return null;
        }

        return Math.max(0, previous - 1);
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasActiveCountdown]);

  useEffect(() => {
    const phase = gameState?.phase ?? "";
    const didEnterPendingNextRoundPhase =
      (phase === "round_start_pending" || phase === "category_selection")
      && previousPhaseRef.current !== phase;

    previousPhaseRef.current = phase;

    if (!didEnterPendingNextRoundPhase) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      resetRoundUiState({
        clearSelection: true,
        clearRoundResults: true,
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [gameState?.phase]);

  useEffect(() => {
    if (isPreviewMode) {
      return;
    }

    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0 || resolvedPlayerId <= 0) {
      return;
    }

    if (submittedWords.length === 0 && !currentWord.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await fetch(`${API_BASE_URL}/api/rounds/${resolvedRoundId}/drafts`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              playerId: resolvedPlayerId,
              currentInput: currentWord,
              words: submittedWords,
            }),
          });
        } catch {
          // Best effort only while typing.
        }
      })();
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentWord, isPreviewMode, resolvedPlayerId, resolvedRoundId, submittedWords]);

  const fetchCategoriesByDifficulty = async (difficulty: "easy" | "medium" | "hard") => {
    setSelectedDifficulty(difficulty);
    setSelectedCategory("");
    setSelectedCategoryName("");
    setCategoriesError("");
    setIsCategoriesLoading(true);

    if (isPreviewMode) {
      setCategories(previewCategories.filter((category) => category.difficulty === difficulty));
      setIsCategoriesLoading(false);
      return;
    }

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
    if (isPreviewMode) {
      const matchedCategory = categories.find((category) => category.id === categoryId) ?? previewCategories.find((category) => category.id === categoryId) ?? null;
      const nextPlayerId = getNextPlayerId(resolvedPlayerId);

      setSelectedCategory(String(categoryId));
      setSelectedCategoryName(matchedCategory?.name ?? "");
      setCurrentBidCount("");
      setIsCategoryModalOpen(false);
      setSubmissionError("");
      setGameState((previousState) => previousState
        ? {
          ...previousState,
          phase: "bidding",
          categoryId,
          categoryName: matchedCategory?.name ?? previousState.categoryName,
          highestBidCount: bidCount,
          highestBidPlayerId: resolvedPlayerId,
          highestBidPlayerName: username,
          activePlayerId: nextPlayerId,
          activePlayerName: getPlayerName(nextPlayerId),
          secondsRemaining: 32,
        }
        : previousState);
      setRoundResults((previousResults) => previousResults
        ? {
          ...previousResults,
          status: "bidding",
          currentPlayerId: nextPlayerId,
          currentPlayerName: getPlayerName(nextPlayerId),
          highestBidCount: bidCount,
          highestBidPlayerId: resolvedPlayerId,
          highestBidPlayerName: username,
          category: {
            categoryId,
            categoryName: matchedCategory?.name ?? previousResults.category.categoryName,
            pointsPerWord: matchedCategory?.points ?? previousResults.category.pointsPerWord,
          },
        }
        : previousResults);
      setCountdownSeconds(32);
      return;
    }

    if (!Number.isFinite(resolvedGameId) || resolvedGameId <= 0) {
      throw new Error("Missing gameId. Add gameId in the lobby URL.");
    }

    setIsSubmittingBid(true);

    try {
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
      setCountdownSeconds(null);
      setSubmissionError("");
      setGameState((previousState) => previousState
        ? {
          ...previousState,
          currentRoundId: startedRoundId,
          phase: data.status ?? "bidding",
          allPlayersReady: false,
          readyPlayerIds: [],
          readyPlayersCount: 0,
        }
        : previousState);
      setRoundResults((previousResults) => previousResults
        ? {
          ...previousResults,
          roundId: startedRoundId,
          roundNumber: data.roundNumber ?? previousResults.roundNumber,
          status: data.status ?? "bidding",
          category: {
            ...previousResults.category,
            categoryId,
            categoryName: matchedCategory?.name ?? previousResults.category.categoryName,
          },
          highestBidCount: bidCount,
          highestBidPlayerId: resolvedPlayerId > 0 ? resolvedPlayerId : previousResults.highestBidPlayerId,
          highestBidPlayerName: username || previousResults.highestBidPlayerName,
        }
        : buildOptimisticRoundResults(startedRoundId, data.status ?? "bidding", {
          roundNumber: data.roundNumber ?? 1,
          currentPlayerId: getNextPlayerId(resolvedPlayerId),
          currentPlayerName: getPlayerName(getNextPlayerId(resolvedPlayerId)),
          highestBidCount: bidCount,
          highestBidPlayerId: resolvedPlayerId,
          highestBidPlayerName: username || null,
          category: {
            categoryId,
            categoryName: matchedCategory?.name ?? selectedCategoryName ?? null,
            pointsPerWord: matchedCategory?.points ?? null,
          },
        }));

      void fetchGameState();
      void fetchRoundResults(startedRoundId);
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submitWord();
    }
  };

  const markPlayerReady = async () => {
    setSubmissionError("");

    if (isPreviewMode) {
      setPlayers((previousPlayers) => previousPlayers.map((player) =>
        Number(player.id) === resolvedPlayerId
          ? { ...player, isReady: true }
          : player
      ));
      setGameState((previousState) => previousState
        ? {
          ...previousState,
          phase: "category_selection",
          readyPlayerIds: Array.from(new Set([...(previousState.readyPlayerIds ?? []), resolvedPlayerId])),
          readyPlayersCount: Array.from(new Set([...(previousState.readyPlayerIds ?? []), resolvedPlayerId])).length,
        }
        : previousState);
      return;
    }

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

    if (isPreviewMode) {
      const normalized = trimmed.toLowerCase();
      const alreadySubmitted = submittedWords.some((word) => word.toLowerCase() === normalized);
      const activeCategoryId = gameState?.categoryId ?? roundResults?.category.categoryId ?? 0;
      const validPreviewWords = previewValidWordsByCategoryId[activeCategoryId] ?? [];
      const isValidForCategory = validPreviewWords.includes(normalized);
      const accepted = !alreadySubmitted && isValidForCategory;

      setCurrentWord("");
      setResults((previousResults) => [
        ...previousResults,
        {
          word: trimmed,
          correct: accepted,
          pending: false,
          submittedBy: username,
        },
      ]);

      if (accepted) {
        setSubmittedWords((previousWords) => [...previousWords, trimmed]);
        setLiveDrafts((previousDrafts) => previousDrafts.map((draft) =>
          draft.playerId === resolvedPlayerId
            ? {
              ...draft,
              currentInput: "",
              words: [...draft.words, trimmed],
            }
            : draft
        ));
      }

      setSubmissionError(accepted ? "" : alreadySubmitted ? "You already used that word." : "That word is not valid for this category.");
      return;
    }

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

      const data = (await response.json()) as ExtendedValidateWordResponse;

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

      if (data.challengeCompleted) {
        const nextPlayerId = getNextPlayerId(resolvedPlayerId);
        setSubmissionSummary({
          roundId: resolvedRoundId,
          playerId: resolvedPlayerId,
          challengeId: 0,
          requiredWordCount: data.requiredWordCount ?? 0,
          validUniqueWordCount: data.validUniqueWordCount ?? 0,
          succeeded: !!data.challengeSucceeded,
          awardedPoints: data.awardedPoints ?? 0,
          words: [],
        });
        setGameState((previousState) => previousState
          ? {
            ...previousState,
            phase: "round_start_pending",
            activePlayerId: nextPlayerId,
            activePlayerName: getPlayerName(nextPlayerId),
            deadlineUtc: null,
            secondsRemaining: null,
            readyPlayerIds: [],
            readyPlayersCount: 0,
            allPlayersReady: false,
          }
          : previousState);
        setRoundResults((previousResults) => previousResults
          ? {
            ...previousResults,
            status: "completed",
            currentPlayerId: nextPlayerId,
            currentPlayerName: getPlayerName(nextPlayerId),
            deadlineUtc: null,
            secondsRemaining: null,
            players: previousResults.players.map((player) =>
              player.userId === resolvedPlayerId
                ? { ...player, score: player.score + (data.awardedPoints ?? 0) }
                : player
            ),
            challenges: previousResults.challenges.map((challenge) =>
              challenge.challengedPlayerId === resolvedPlayerId
                ? {
                  ...challenge,
                  status: data.challengeSucceeded ? "succeeded" : "failed",
                  validUniqueWordCount: data.validUniqueWordCount ?? challenge.validUniqueWordCount,
                }
                : challenge
            ),
          }
          : buildOptimisticRoundResults(resolvedRoundId, "completed", {
            currentPlayerId: nextPlayerId,
            currentPlayerName: getPlayerName(nextPlayerId),
            players: players
              .map((player) => ({
                userId: Number(player.id),
                username: player.username,
                score: (player.score ?? 0) + (Number(player.id) === resolvedPlayerId ? (data.awardedPoints ?? 0) : 0),
                turnOrder: player.playerOrder ?? 99,
              }))
              .filter((player) => Number.isFinite(player.userId) && player.userId > 0),
            challenges: [
              {
                id: 0,
                challengedPlayerId: resolvedPlayerId,
                requiredWordCount: data.requiredWordCount ?? 0,
                status: data.challengeSucceeded ? "succeeded" : "failed",
                validUniqueWordCount: data.validUniqueWordCount ?? 0,
              },
            ],
          }));

        await fetchGameState();
        await fetchRoundResults(resolvedRoundId);
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

    if (isPreviewMode) {
      const bidCount = Number(currentBidCount);
      if (!Number.isFinite(bidCount) || bidCount <= 0) {
        setSubmissionError("Enter a valid number before placing a bid.");
        return;
      }

      const nextPlayerId = getNextPlayerId(resolvedPlayerId);
      setCurrentBidCount("");
      setGameState((previousState) => previousState
        ? {
          ...previousState,
          phase: "bidding",
          highestBidCount: bidCount,
          highestBidPlayerId: resolvedPlayerId,
          highestBidPlayerName: username,
          activePlayerId: nextPlayerId,
          activePlayerName: getPlayerName(nextPlayerId),
          secondsRemaining: 22,
        }
        : previousState);
      setRoundResults((previousResults) => previousResults
        ? {
          ...previousResults,
          status: "bidding",
          highestBidCount: bidCount,
          highestBidPlayerId: resolvedPlayerId,
          highestBidPlayerName: username,
          currentPlayerId: nextPlayerId,
          currentPlayerName: getPlayerName(nextPlayerId),
        }
        : previousResults);
      setCountdownSeconds(22);
      return;
    }

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
      const nextPlayerId = getNextPlayerId(resolvedPlayerId);
      setGameState((previousState) => previousState
        ? {
          ...previousState,
          phase: "bidding",
          activePlayerId: nextPlayerId,
          activePlayerName: getPlayerName(nextPlayerId),
        }
        : previousState);
      setRoundResults((previousResults) => previousResults
        ? {
          ...previousResults,
          status: "bidding",
          currentPlayerId: nextPlayerId,
          currentPlayerName: getPlayerName(nextPlayerId),
          highestBidCount: bidCount,
          highestBidPlayerId: resolvedPlayerId,
          highestBidPlayerName: username || previousResults.highestBidPlayerName,
        }
        : buildOptimisticRoundResults(resolvedRoundId, "bidding", {
          currentPlayerId: nextPlayerId,
          currentPlayerName: getPlayerName(nextPlayerId),
          highestBidCount: bidCount,
          highestBidPlayerId: resolvedPlayerId,
          highestBidPlayerName: username || null,
        }));

      void fetchGameState();
      void fetchRoundResults(resolvedRoundId);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not place bid.");
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const callBluff = async () => {
    setSubmissionError("");

    if (isPreviewMode) {
      setGameState((previousState) => previousState
        ? {
          ...previousState,
          phase: "challenge_active",
          activePlayerId: highestBidPlayerId,
          activePlayerName: highestBidPlayerName,
          secondsRemaining: 60,
        }
        : previousState);
      setRoundResults((previousResults) => previousResults
        ? {
          ...previousResults,
          status: "challenge_active",
          currentPlayerId: highestBidPlayerId,
          currentPlayerName: highestBidPlayerName,
        }
        : previousResults);
      setCountdownSeconds(60);
      return;
    }

    if (!Number.isFinite(resolvedRoundId) || resolvedRoundId <= 0 || !syncedRoundResults) {
      setSubmissionError("There is no bid to challenge.");
      return;
    }

    if (resolvedPlayerId <= 0) {
      setSubmissionError("Missing playerId. Wait for the lobby player list to load and try again.");
      return;
    }

    if (!highestBidPlayerId || !highestBidCount) {
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
          challengedPlayerId: highestBidPlayerId,
          requiredWordCount: highestBidCount,
          timeLimitSeconds: 60,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Could not challenge this bid.");
      }

      const challengedPlayerId = highestBidPlayerId;
      const challengedPlayerName = getPlayerName(challengedPlayerId);
      setSubmittedWords([]);
      setResults([]);
      setSubmissionSummary(null);
      setCurrentWord("");
      setLiveDrafts([]);
      setGameState((previousState) => previousState
        ? {
          ...previousState,
          phase: "challenge_active",
          activePlayerId: challengedPlayerId,
          activePlayerName: challengedPlayerName,
        }
        : previousState);
      setRoundResults((previousResults) => previousResults
        ? {
          ...previousResults,
          status: "challenge_active",
          currentPlayerId: challengedPlayerId,
          currentPlayerName: challengedPlayerName,
          challenges: previousResults.challenges.some((challenge) => challenge.challengedPlayerId === challengedPlayerId)
            ? previousResults.challenges
            : [
              ...previousResults.challenges,
              {
                id: 0,
                challengedPlayerId,
                requiredWordCount: highestBidCount ?? 0,
                status: "active",
                validUniqueWordCount: 0,
              },
            ],
        }
        : buildOptimisticRoundResults(resolvedRoundId, "challenge_active", {
          currentPlayerId: challengedPlayerId,
          currentPlayerName: challengedPlayerName,
          highestBidCount,
          highestBidPlayerId,
          highestBidPlayerName,
          challenges: [
            {
              id: 0,
              challengedPlayerId,
              requiredWordCount: highestBidCount ?? 0,
              status: "active",
              validUniqueWordCount: 0,
            },
          ],
        }));

      void fetchGameState();
      void fetchRoundResults(resolvedRoundId);
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

  const activeRoundId = Number(gameState?.currentRoundId ?? resolvedRoundId ?? 0);
  const firstPlayerId = players
    .slice()
    .sort((left, right) => (left.playerOrder ?? 99) - (right.playerOrder ?? 99))[0]?.id;
  const firstPlayerIdAsNumber = Number(firstPlayerId ?? 0);
  const currentPhase = gameState?.phase ?? roundResults?.status ?? "waiting";
  const shouldShowRoundResults = currentPhase !== "round_start_pending" && currentPhase !== "category_selection";
  const syncedRoundResults = shouldShowRoundResults && roundResults && roundResults.roundId === activeRoundId
    ? roundResults
    : null;
  const displayPlayersFromRoundResults = syncedRoundResults?.players.map((player) => ({
    id: player.userId,
    username: player.username,
    score: player.score,
    playerOrder: player.turnOrder,
  })) ?? [];
  const topPlayers = displayPlayersFromRoundResults.length ? displayPlayersFromRoundResults.slice(0, 4) : displayPlayers;
  const shownCategoryName = gameState?.categoryName
    || syncedRoundResults?.category.categoryName
    || (currentPhase === "category_selection"
      ? (selectedCategoryName || categories.find((category) => String(category.id) === selectedCategory)?.name)
      : null);
  const roundStatus = syncedRoundResults?.status ?? currentPhase;
  const activePlayerId = gameState?.activePlayerId ?? syncedRoundResults?.currentPlayerId ?? null;
  const highestBidCount = gameState?.highestBidCount ?? syncedRoundResults?.highestBidCount ?? null;
  const highestBidPlayerId = gameState?.highestBidPlayerId ?? syncedRoundResults?.highestBidPlayerId ?? null;
  const highestBidPlayerName = gameState?.highestBidPlayerName ?? syncedRoundResults?.highestBidPlayerName ?? null;
  const currentTurnPlayerName = gameState?.activePlayerName ?? syncedRoundResults?.currentPlayerName ?? null;
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
  const canChallenge = canBid && !!highestBidCount && highestBidPlayerId !== resolvedPlayerId;
  const canSubmitWords = roundStatus === "challenge_active" && isMyTurn;
  const canSetOpeningBid = canChooseCategory && !!selectedCategory;
  const primaryActionLabel = canChooseCategory
    ? "Choose category"
    : isRoundStartPending
      ? "Start round"
      : canSubmitWords
        ? "Write words"
        : canBid
          ? "Make your move"
          : "Watch the round";

  const wordsLeftToType = Math.max(0, (highestBidCount ?? 0) - submittedWords.length);
  const challengeProgressPercent = highestBidCount
    ? Math.min(100, Math.round((submittedWords.length / highestBidCount) * 100))
    : 0;
  const currentPlayerCard = topPlayers.find((player) => Number(player.id) === activePlayerId) ?? null;
  const activeTurnName = currentPlayerCard?.username ?? currentTurnPlayerName ?? "Waiting...";
  const stageInstruction = canChooseCategory
    ? (isMyTurn ? "Step 1: Choose a category. Step 2: Set your bid." : `${activeTurnName} is choosing a category and opening bid.`)
    : canSubmitWords
      ? (isMyTurn ? "It's your turn to write words." : `It's ${activeTurnName}'s turn to write words.`)
      : canBid
        ? "It's your turn to bid or challenge."
        : roundStatus === "bidding"
          ? `It's ${activeTurnName}'s turn to bid or challenge.`
          : isRoundStartPending
            ? (isMyTurn ? "It's your turn to get ready for the next round." : `Waiting for ${activeTurnName} to get ready.`)
            : `It's ${activeTurnName}'s turn.`;
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
          : syncedRoundResults?.status === "completed"
            ? `${currentTurnPlayerName ?? "Next player"} starts the next round.`
            : "Waiting for the first round to start.";
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
  const shownRoundNumber = gameState?.roundNumber ?? roundResults?.roundNumber ?? 0;
  const currentAnswerCards = results
    .filter((result) => !result.pending)
    .filter((result) => {
      if (!result.submittedBy) {
        return isMyTurn;
      }

      return result.submittedBy.toLowerCase() === activeTurnName.toLowerCase();
    })
    .slice(-6);
  const shouldShowAnswerPanel = !canChooseCategory && !canSubmitWords && currentAnswerCards.length > 0;
  const shouldShowDetailPanels = !canChooseCategory && !isRoundStartPending && !canSubmitWords;

  return (
    <main className="page">
      <section className="card sketch-lobby-card">
        <div className="sketch-lobby-top">
          <div className="sketch-meta-strip">
            <div className="sketch-meta-pill">Lobby {sessionCode || "XXXX-XXXX"}</div>
            <div className="sketch-meta-pill">Round {gameState?.roundNumber ?? roundResults?.roundNumber ?? 0}</div>
            {countdownSeconds !== null ? <div className="sketch-meta-pill">{countdownSeconds}s left</div> : null}
            {isMyTurn ? <div className="sketch-meta-pill sketch-meta-pill-active">Your turn</div> : null}
            {!isMyTurn && currentTurnPlayerName ? <div className="sketch-meta-pill">{currentTurnPlayerName}</div> : null}
          </div>
          <Link className="rules-link sketch-back-link" to="/">
            Back
          </Link>
        </div>

        <div className="sketch-player-row">
          {topPlayers.map((player, index) => {
            const playerId = Number(player.id);
            const isActivePlayer = playerId === activePlayerId;
            const isCurrentUser = playerId === resolvedPlayerId;
            const playerStatus = isActivePlayer
              ? "playing"
              : readyPlayerIds.has(playerId)
                ? "ready"
                : isCurrentUser
                  ? "you"
                  : "waiting";
            const playerStatusLabel = isActivePlayer
              ? (countdownSeconds !== null ? `Playing now - ${countdownSeconds}s` : "Playing now")
              : playerStatus === "ready"
                ? "Ready"
                : playerStatus === "you"
                  ? "You"
                  : "Waiting";

            return (
            <article
              className={`sketch-player-slot status-${playerStatus}${isActivePlayer ? " active-turn" : ""}${isCurrentUser ? " current-user" : ""}`}
              key={player.id ?? index}
            >
              <div className="sketch-player-head">
                <h2 className="sketch-player-label">{player.username || `Player ${index + 1}`}</h2>
                <span className="sketch-player-score">{player.score ?? 0}p</span>
              </div>
              <div className="sketch-player-avatar" aria-hidden="true">
                <span className="sketch-player-avatar-eye left" />
                <span className="sketch-player-avatar-eye right" />
                <span className="sketch-player-avatar-mouth" />
                <span className="sketch-player-avatar-trait" />
              </div>
              <div className="sketch-score-meter" aria-hidden="true">
                <span style={{ width: `${Math.min(100, Math.max(8, (player.score ?? 0) * 8))}%` }} />
              </div>
              <p className="sketch-player-status">{playerStatusLabel}</p>
            </article>
            );
          })}
        </div>

        <div className="sketch-lobby-body">
          <section className="sketch-main-column">
            <section className={`sketch-stage-card${canSubmitWords ? " is-writing" : ""}`}>
              <div className="sketch-stage-header">
                <div>
                  <p className="sketch-stage-kicker">{primaryActionLabel}</p>
                  <h2 className="sketch-stage-title">
                    {stageInstruction}
                  </h2>
                </div>
                <div className="sketch-stage-turn">
                  <span className="sketch-focus-chip">Round {shownRoundNumber}</span>
                  <strong>{activeTurnName}</strong>
                </div>
              </div>
              <p className="sketch-turn-status">{roundMessage}</p>
              <div className={`sketch-stage-grid${shouldShowAnswerPanel ? "" : " is-focused"}`}>
                <div className="sketch-stage-main">
                  {canSubmitWords ? (
                    <div className="sketch-writing-focus">
                      <div className="sketch-writing-hero">
                        <div className="sketch-writing-timer" aria-label={countdownSeconds !== null ? `${countdownSeconds} seconds left` : "No timer"}>
                          <span>{countdownSeconds !== null ? countdownSeconds : "--"}</span>
                          <small>sec</small>
                        </div>
                        <div>
                          <p className="sketch-stage-kicker">Typing challenge</p>
                          <h3 className="sketch-writing-title">{shownCategoryName ?? "Unknown category"}</h3>
                          <p className="sketch-writing-copy">
                            Add {highestBidCount ?? 0} accepted words before time runs out.
                          </p>
                        </div>
                      </div>

                      <div className="sketch-writing-progress" aria-label={`${submittedWords.length} of ${highestBidCount ?? 0} words accepted`}>
                        <div>
                          <span>Accepted</span>
                          <strong>{submittedWords.length}/{highestBidCount ?? 0}</strong>
                        </div>
                        <div className="sketch-writing-meter" aria-hidden="true">
                          <span style={{ width: `${challengeProgressPercent}%` }} />
                        </div>
                        <p>{wordsLeftToType === 0 ? "All words done." : `${wordsLeftToType} left`}</p>
                      </div>

                      <div className="sketch-writing-input-row">
                        <label className="sketch-field-label" htmlFor="word-input">Type a word</label>
                        <div className="sketch-writing-input-wrap">
                          <input
                            id="word-input"
                            className="sketch-word-input sketch-writing-input"
                            type="text"
                            placeholder="Type a word and press Enter"
                            value={currentWord}
                            onChange={(e) => setCurrentWord(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={!canSubmitWords}
                            autoFocus
                          />
                          <button
                            className="primary sketch-add-word-button"
                            type="button"
                            onClick={() => void submitWord()}
                            disabled={!currentWord.trim()}
                          >
                            Add word
                          </button>
                        </div>
                      </div>

                      {submittedWords.length > 0 ? (
                        <div className="sketch-accepted-strip" aria-label="Accepted words">
                          {submittedWords.map((word) => (
                            <span key={word}>{word}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="sketch-writing-empty">Accepted words will appear here.</p>
                      )}

                      <div className="sketch-feedback-row">
                        {submissionError && <p className="sketch-feedback-text is-error">{submissionError}</p>}
                        {submissionSummary && (
                          <p className="sketch-feedback-text">
                            {submissionSummary.succeeded ? "Challenge succeeded." : "Challenge failed."} Awarded points: {submissionSummary.awardedPoints}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                  <>
                  <div className="sketch-summary-card">
                    <span className="sketch-summary-label">Current bid</span>
                    <p className="sketch-summary-sentence">
                      {highestBidCount
                        ? `${highestBidPlayerName ?? "Someone"} has bid that they can name ${highestBidCount} ${shownCategoryName ?? "words"}.`
                        : shownCategoryName
                          ? `No one has placed a bid for ${shownCategoryName} yet.`
                          : "Choose a category to start the bidding."}
                    </p>
                  </div>

                  {isRoundStartPending ? (
                    <div className="sketch-stage-actions single">
                      <button className="primary" type="button" onClick={() => void markPlayerReady()} disabled={amIReady || isMarkingReady}>
                        {isMarkingReady ? "Starting..." : amIReady ? "Ready" : "Start round"}
                      </button>
                    </div>
                  ) : (
                    <>
                      {(canBid || canSetOpeningBid) ? (
                        <div className="sketch-input-block">
                          <label className="sketch-field-label" htmlFor="bid-input">Bid</label>
                          <input
                            id="bid-input"
                            className="sketch-word-input"
                            type="number"
                            min="1"
                            placeholder={canChooseCategory ? "Opening bid" : highestBidCount ? `More than ${highestBidCount}` : "Enter bid"}
                            value={currentBidCount}
                            onChange={(e) => setCurrentBidCount(e.target.value)}
                            disabled={(!canBid && !canSetOpeningBid) || isSubmittingBid}
                          />
                        </div>
                      ) : null}

                      <div className="sketch-stage-actions">
                        {canChooseCategory ? (
                          <button
                            className="primary sketch-focus-action"
                            type="button"
                            onClick={() => setIsCategoryModalOpen(true)}
                          >
                            Choose category
                          </button>
                        ) : null}
                        {(canBid || canSetOpeningBid) ? (
                          <button
                            className={canChooseCategory ? "primary sketch-secondary-action" : "primary"}
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
                            {isSubmittingBid ? "Saving..." : canChooseCategory ? "Start round" : "Raise bid"}
                          </button>
                        ) : null}
                        {canChallenge ? (
                          <button className="primary sketch-secondary-action" type="button" onClick={() => void callBluff()} disabled={isCallingBluff}>
                            {isCallingBluff ? "Checking..." : "Bullshit"}
                          </button>
                        ) : null}
                      </div>

                    </>
                  )}

                  <div className="sketch-feedback-row">
                    {selectedDifficulty && <p className="sketch-feedback-text">Difficulty: {selectedDifficulty}</p>}
                    {submittedWords.length > 0 && <p className="sketch-feedback-text">Accepted: {submittedWords.join(", ")}</p>}
                    {canSubmitWords ? <p className="sketch-feedback-text">Words left: {wordsLeftToType}</p> : null}
                    {submissionError && <p className="sketch-feedback-text is-error">{submissionError}</p>}
                    {submissionSummary && (
                      <p className="sketch-feedback-text">
                        {submissionSummary.succeeded ? "Challenge succeeded." : "Challenge failed."} Awarded points: {submissionSummary.awardedPoints}
                      </p>
                    )}
                  </div>
                  </>
                  )}
                </div>

                {shouldShowAnswerPanel ? (
                <aside className="sketch-side-panel">
                  <div className="sketch-side-card">
                    <h3 className="sketch-side-title">{activeTurnName}'s answers</h3>
                    <ul className="sketch-answer-list">
                      {currentAnswerCards.map((answer, index) => (
                        <li
                          className={`sketch-answer-item ${answer.correct ? "correct" : "incorrect"}`}
                          key={`${answer.word}-${answer.createdAt ?? index}-${index}`}
                        >
                          <span>{answer.word}</span>
                          <span>{answer.correct ? "Correct" : "Wrong"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </aside>
                ) : null}
              </div>
            </section>

            {shouldShowDetailPanels ? (
            <div className="sketch-detail-panels">
              <details className="sketch-detail-card">
                <summary className="sketch-detail-summary">Word history</summary>
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
              </details>

              <details className="sketch-detail-card">
                <summary className="sketch-detail-summary">Live answers</summary>
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
              </details>
            </div>
            ) : null}
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
