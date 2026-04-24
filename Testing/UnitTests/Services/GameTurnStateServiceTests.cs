using Server.Data.Entities;
using Server.Services;
using Xunit;

namespace WordGame.UnitTests.Services;

public class GameTurnStateServiceTests
{
    [Fact]
    public void ResolveCategorySelection_UsesFirstPlayerForNewGame()
    {
        var service = new GameTurnStateService();
        List<GamePlayer> players =
        [
            new GamePlayer { UserId = 10, TurnOrder = 1 },
            new GamePlayer { UserId = 20, TurnOrder = 2 }
        ];

        var result = service.ResolveCategorySelection(gameId: 7, players);

        Assert.Equal(10, result.ActivePlayerId);
        Assert.True(result.DeadlineUtc > DateTime.UtcNow);
    }

    [Fact]
    public void ResolveCategorySelection_ThrowsWhenThereAreNoPlayers()
    {
        var service = new GameTurnStateService();

        var exception = Assert.Throws<InvalidOperationException>(() => service.ResolveCategorySelection(7, []));

        Assert.Equal("This game has no players.", exception.Message);
    }

    [Fact]
    public void StartCategorySelection_OverridesExistingState()
    {
        var service = new GameTurnStateService();
        List<GamePlayer> players =
        [
            new GamePlayer { UserId = 10, TurnOrder = 1 },
            new GamePlayer { UserId = 20, TurnOrder = 2 }
        ];

        var original = service.ResolveCategorySelection(gameId: 7, players);
        service.StartCategorySelection(gameId: 7, activePlayerId: 20);

        var updated = service.ResolveCategorySelection(gameId: 7, players);

        Assert.Equal(20, updated.ActivePlayerId);
        Assert.True(updated.DeadlineUtc >= original.DeadlineUtc);
    }

    [Fact]
    public void Clear_RemovesStoredStateForGame()
    {
        var service = new GameTurnStateService();
        List<GamePlayer> players =
        [
            new GamePlayer { UserId = 10, TurnOrder = 1 },
            new GamePlayer { UserId = 20, TurnOrder = 2 }
        ];

        service.StartCategorySelection(gameId: 7, activePlayerId: 20);
        service.Clear(gameId: 7);

        var result = service.ResolveCategorySelection(gameId: 7, players);

        Assert.Equal(10, result.ActivePlayerId);
    }
}
