using System.Collections.Concurrent;

namespace Server.Services;

public class GameConcurrencyService
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new(StringComparer.Ordinal);

    public SemaphoreSlim GetGameLock(int gameId)
    {
        return _locks.GetOrAdd($"game:{gameId}", _ => new SemaphoreSlim(1, 1));
    }

    public SemaphoreSlim GetRoundLock(int roundId)
    {
        return _locks.GetOrAdd($"round:{roundId}", _ => new SemaphoreSlim(1, 1));
    }
}
