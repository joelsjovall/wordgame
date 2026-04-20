using System.Collections.Concurrent;

namespace Server.Services;

public class LobbyStateService
{
    private readonly ConcurrentDictionary<string, LobbyState> _states = new(StringComparer.OrdinalIgnoreCase);
    private const string InProgressStatus = "in-progress";

    public LobbyState GetState(string gameCode)
    {
        return _states.GetOrAdd(gameCode, _ => new LobbyState());
    }

    public LobbyState StartGame(string gameCode, int firstPlayerOrder)
    {
        if (firstPlayerOrder <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(firstPlayerOrder), "First player order must be greater than zero.");
        }

        var state = GetState(gameCode);

        lock (state.SyncRoot)
        {
            state.GameStatus = InProgressStatus;
            state.CurrentRoundNumber = Math.Max(1, state.CurrentRoundNumber);
            state.CurrentTurnPlayerOrder = firstPlayerOrder;
            ResetRoundState(state);
        }

        return state;
    }

    public LobbyState SetCategory(string gameCode, LobbyCategorySelection selection, int playerOrder)
    {
        var state = GetState(gameCode);

        lock (state.SyncRoot)
        {
            EnsureGameStarted(state);
            EnsurePlayersTurn(state, playerOrder);
            state.SelectedCategoryId = selection.CategoryId;
            state.SelectedCategoryName = selection.CategoryName;
            state.SelectedDifficulty = selection.Difficulty;
        }

        return state;
    }

    public LobbyState AddGuess(string gameCode, LobbyGuess guess, int playerOrder, int totalPlayers)
    {
        var state = GetState(gameCode);

        lock (state.SyncRoot)
        {
            EnsureGameStarted(state);
            EnsurePlayersTurn(state, playerOrder);

            if (state.SelectedCategoryId is null)
            {
                throw new InvalidOperationException("Choose a category before submitting words.");
            }

            guess.RoundNumber = state.CurrentRoundNumber;
            state.Guesses.Add(guess);

            var correctCount = state.Guesses.Count(existingGuess => existingGuess.Correct);
            if (correctCount >= state.RoundTargetWordCount)
            {
                AdvanceRound(state, totalPlayers);
            }
        }

        return state;
    }

    private static void AdvanceRound(LobbyState state, int totalPlayers)
    {
        if (totalPlayers <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(totalPlayers), "Total players must be greater than zero.");
        }

        state.CurrentRoundNumber += 1;
        state.CurrentTurnPlayerOrder = ((state.CurrentTurnPlayerOrder ?? 1) % totalPlayers) + 1;
        ResetRoundState(state);
    }

    private static void ResetRoundState(LobbyState state)
    {
        state.SelectedCategoryId = null;
        state.SelectedCategoryName = string.Empty;
        state.SelectedDifficulty = string.Empty;
        state.Guesses.Clear();
    }

    private static void EnsureGameStarted(LobbyState state)
    {
        if (!string.Equals(state.GameStatus, InProgressStatus, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The game has not started yet.");
        }
    }

    private static void EnsurePlayersTurn(LobbyState state, int playerOrder)
    {
        if (state.CurrentTurnPlayerOrder != playerOrder)
        {
            throw new InvalidOperationException("Only the active player can do that right now.");
        }
    }
}

public class LobbyState
{
    internal object SyncRoot { get; } = new();

    public string GameStatus { get; set; } = "lobby";
    public int CurrentRoundNumber { get; set; } = 0;
    public int? CurrentTurnPlayerOrder { get; set; }
    public int RoundTargetWordCount { get; set; } = 10;
    public int? SelectedCategoryId { get; set; }
    public string SelectedCategoryName { get; set; } = string.Empty;
    public string SelectedDifficulty { get; set; } = string.Empty;
    public List<LobbyGuess> Guesses { get; } = [];
}

public class LobbyCategorySelection
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
}

public class LobbyGuess
{
    public string Word { get; set; } = string.Empty;
    public bool Correct { get; set; }
    public string SubmittedBy { get; set; } = string.Empty;
    public int RoundNumber { get; set; }
    public DateTime CreatedAt { get; set; }
}
