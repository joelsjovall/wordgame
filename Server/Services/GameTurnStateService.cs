using System.Collections.Concurrent;
using Server.Data.Entities;

namespace Server.Services;

public class GameTurnStateService
{
    private const int CategorySelectionSeconds = 45;
    private readonly ConcurrentDictionary<int, GameTurnState> _states = new();

    public GameTurnState ResolveCategorySelection(int gameId, IReadOnlyList<GamePlayer> orderedPlayers)
    {
        if (orderedPlayers.Count == 0)
        {
            throw new InvalidOperationException("This game has no players.");
        }

        var state = _states.GetOrAdd(gameId, _ => new GameTurnState
        {
            ActivePlayerId = orderedPlayers[0].UserId,
            DeadlineUtc = DateTime.UtcNow.AddSeconds(CategorySelectionSeconds)
        });

        lock (state.SyncRoot)
        {
            return new GameTurnState
            {
                ActivePlayerId = state.ActivePlayerId,
                DeadlineUtc = state.DeadlineUtc
            };
        }
    }

    public void StartCategorySelection(int gameId, int activePlayerId)
    {
        var state = _states.GetOrAdd(gameId, _ => new GameTurnState());

        lock (state.SyncRoot)
        {
            state.ActivePlayerId = activePlayerId;
            state.DeadlineUtc = DateTime.UtcNow.AddSeconds(CategorySelectionSeconds);
        }
    }

    public void Clear(int gameId)
    {
        _states.TryRemove(gameId, out _);
    }
}

public class GameTurnState
{
    internal object SyncRoot { get; } = new();

    public int ActivePlayerId { get; set; }
    public DateTime DeadlineUtc { get; set; }
}
