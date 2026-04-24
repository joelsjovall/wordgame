using System.Collections.Concurrent;
using Nito.AsyncEx;

namespace Server.Services;

public class GameConcurrencyService
{
    private readonly ConcurrentDictionary<string, AsyncReaderWriterLock> _locks = new(StringComparer.Ordinal);

    public AsyncReaderWriterLock GetGameLock(int gameId)
    {
        return _locks.GetOrAdd($"game:{gameId}", _ => new AsyncReaderWriterLock());
    }

    public AsyncReaderWriterLock GetRoundLock(int roundId)
    {
        return _locks.GetOrAdd($"round:{roundId}", _ => new AsyncReaderWriterLock());
    }
}
