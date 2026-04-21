using System.Collections.Concurrent;

namespace Server.Services;

public class RoundLiveDraftService
{
    private readonly ConcurrentDictionary<int, ConcurrentDictionary<int, RoundLiveDraftSnapshot>> _draftsByRound = new();

    public void UpdateDraft(int roundId, int playerId, string currentInput, IEnumerable<string> words)
    {
        var normalizedInput = currentInput ?? string.Empty;
        var normalizedWords = words
            .Where(word => !string.IsNullOrWhiteSpace(word))
            .Select(word => word.Trim())
            .ToList();

        if (string.IsNullOrWhiteSpace(normalizedInput) && normalizedWords.Count == 0)
        {
            ClearPlayer(roundId, playerId);
            return;
        }

        var roundDrafts = _draftsByRound.GetOrAdd(roundId, _ => new ConcurrentDictionary<int, RoundLiveDraftSnapshot>());
        roundDrafts[playerId] = new RoundLiveDraftSnapshot
        {
            PlayerId = playerId,
            CurrentInput = normalizedInput,
            Words = normalizedWords,
            UpdatedAt = DateTime.UtcNow
        };
    }

    public IReadOnlyList<RoundLiveDraftSnapshot> GetDrafts(int roundId)
    {
        if (!_draftsByRound.TryGetValue(roundId, out var roundDrafts))
        {
            return [];
        }

        return roundDrafts.Values
            .OrderBy(draft => draft.PlayerId)
            .Select(draft => new RoundLiveDraftSnapshot
            {
                PlayerId = draft.PlayerId,
                CurrentInput = draft.CurrentInput,
                Words = [.. draft.Words],
                UpdatedAt = draft.UpdatedAt
            })
            .ToList();
    }

    public void ClearPlayer(int roundId, int playerId)
    {
        if (!_draftsByRound.TryGetValue(roundId, out var roundDrafts))
        {
            return;
        }

        roundDrafts.TryRemove(playerId, out _);

        if (roundDrafts.IsEmpty)
        {
            _draftsByRound.TryRemove(roundId, out _);
        }
    }

    public void ClearRound(int roundId)
    {
        _draftsByRound.TryRemove(roundId, out _);
    }

    public void ClearAll()
    {
        _draftsByRound.Clear();
    }
}

public sealed class RoundLiveDraftSnapshot
{
    public int PlayerId { get; init; }
    public string CurrentInput { get; init; } = string.Empty;
    public IReadOnlyList<string> Words { get; init; } = [];
    public DateTime UpdatedAt { get; init; }
}
