using Server.Services;
using Xunit;

namespace WordGame.UnitTests.Services;

public class RoundLiveDraftServiceTests
{
    [Fact]
    public void UpdateDraft_StoresTrimmedWordsForPlayer()
    {
        var service = new RoundLiveDraftService();

        service.UpdateDraft(roundId: 5, playerId: 2, currentInput: "ca", words: ["  cat ", "", "dog"]);

        var drafts = service.GetDrafts(roundId: 5);
        var draft = Assert.Single(drafts);
        Assert.Equal(2, draft.PlayerId);
        Assert.Equal("ca", draft.CurrentInput);
        Assert.Equal(["cat", "dog"], draft.Words);
    }

    [Fact]
    public void GetDrafts_ReturnsPlayersInPlayerIdOrder()
    {
        var service = new RoundLiveDraftService();

        service.UpdateDraft(roundId: 5, playerId: 3, currentInput: "th", words: ["three"]);
        service.UpdateDraft(roundId: 5, playerId: 1, currentInput: "on", words: ["one"]);

        var drafts = service.GetDrafts(roundId: 5);

        Assert.Equal([1, 3], drafts.Select(draft => draft.PlayerId).ToArray());
    }

    [Fact]
    public void UpdateDraft_ClearsPlayerWhenInputAndWordsAreEmpty()
    {
        var service = new RoundLiveDraftService();
        service.UpdateDraft(roundId: 5, playerId: 2, currentInput: "ca", words: ["cat"]);

        service.UpdateDraft(roundId: 5, playerId: 2, currentInput: "", words: []);

        Assert.Empty(service.GetDrafts(roundId: 5));
    }

    [Fact]
    public void ClearPlayer_RemovesOnlyThatPlayersDraft()
    {
        var service = new RoundLiveDraftService();
        service.UpdateDraft(roundId: 5, playerId: 1, currentInput: "on", words: ["one"]);
        service.UpdateDraft(roundId: 5, playerId: 2, currentInput: "tw", words: ["two"]);

        service.ClearPlayer(roundId: 5, playerId: 1);

        var draft = Assert.Single(service.GetDrafts(roundId: 5));
        Assert.Equal(2, draft.PlayerId);
    }

    [Fact]
    public void ClearRound_RemovesAllDraftsForRound()
    {
        var service = new RoundLiveDraftService();
        service.UpdateDraft(roundId: 5, playerId: 1, currentInput: "on", words: ["one"]);
        service.UpdateDraft(roundId: 6, playerId: 2, currentInput: "tw", words: ["two"]);

        service.ClearRound(roundId: 5);

        Assert.Empty(service.GetDrafts(roundId: 5));
        Assert.Single(service.GetDrafts(roundId: 6));
    }

    [Fact]
    public void GetDrafts_ReturnsCopiesOfStoredWordLists()
    {
        var service = new RoundLiveDraftService();
        service.UpdateDraft(roundId: 5, playerId: 1, currentInput: "on", words: ["one"]);

        var drafts = service.GetDrafts(roundId: 5);
        var copiedWords = drafts[0].Words.ToList();
        copiedWords.Add("mutated");

        var latestDraft = Assert.Single(service.GetDrafts(roundId: 5));
        Assert.Equal(["one"], latestDraft.Words);
    }
}
