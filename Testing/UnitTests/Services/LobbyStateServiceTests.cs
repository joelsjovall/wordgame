using Server.Services;
using Xunit;

namespace WordGame.UnitTests.Services;

public class LobbyStateServiceTests
{
    [Fact]
    public void StartGame_InitializesRoundAndClearsPreviousRoundState()
    {
        var service = new LobbyStateService();
        var state = service.GetState("ABC123");
        state.CurrentRoundNumber = 4;
        state.SelectedCategoryId = 99;
        state.SelectedCategoryName = "Old Category";
        state.SelectedDifficulty = "hard";
        state.Guesses.Add(new LobbyGuess { Word = "old", Correct = true });

        var result = service.StartGame("ABC123", firstPlayerOrder: 2);

        Assert.Equal("in-progress", result.GameStatus);
        Assert.Equal(4, result.CurrentRoundNumber);
        Assert.Equal(2, result.CurrentTurnPlayerOrder);
        Assert.Null(result.SelectedCategoryId);
        Assert.Equal(string.Empty, result.SelectedCategoryName);
        Assert.Equal(string.Empty, result.SelectedDifficulty);
        Assert.Empty(result.Guesses);
    }

    [Fact]
    public void SetCategory_RequiresGameToBeStarted()
    {
        var service = new LobbyStateService();

        var exception = Assert.Throws<InvalidOperationException>(() => service.SetCategory(
            "ABC123",
            new LobbyCategorySelection { CategoryId = 1, CategoryName = "Animals", Difficulty = "easy" },
            playerOrder: 1));

        Assert.Equal("The game has not started yet.", exception.Message);
    }

    [Fact]
    public void SetCategory_RequiresActivePlayersTurn()
    {
        var service = new LobbyStateService();
        service.StartGame("ABC123", firstPlayerOrder: 1);

        var exception = Assert.Throws<InvalidOperationException>(() => service.SetCategory(
            "ABC123",
            new LobbyCategorySelection { CategoryId = 1, CategoryName = "Animals", Difficulty = "easy" },
            playerOrder: 2));

        Assert.Equal("Only the active player can do that right now.", exception.Message);
    }

    [Fact]
    public void AddGuess_RequiresCategoryToBeSelected()
    {
        var service = new LobbyStateService();
        service.StartGame("ABC123", firstPlayerOrder: 1);

        var exception = Assert.Throws<InvalidOperationException>(() => service.AddGuess(
            "ABC123",
            new LobbyGuess { Word = "wolf", Correct = true, SubmittedBy = "Host", CreatedAt = DateTime.UtcNow },
            playerOrder: 1,
            totalPlayers: 2));

        Assert.Equal("Choose a category before submitting words.", exception.Message);
    }

    [Fact]
    public void AddGuess_AdvancesRoundWhenEnoughCorrectWordsHaveBeenSubmitted()
    {
        var service = new LobbyStateService();
        var state = service.StartGame("ABC123", firstPlayerOrder: 1);
        state.RoundTargetWordCount = 2;
        service.SetCategory("ABC123", new LobbyCategorySelection
        {
            CategoryId = 7,
            CategoryName = "Animals",
            Difficulty = "easy"
        }, playerOrder: 1);

        service.AddGuess(
            "ABC123",
            new LobbyGuess { Word = "wolf", Correct = true, SubmittedBy = "Host", CreatedAt = DateTime.UtcNow },
            playerOrder: 1,
            totalPlayers: 3);
        var result = service.AddGuess(
            "ABC123",
            new LobbyGuess { Word = "fox", Correct = true, SubmittedBy = "Host", CreatedAt = DateTime.UtcNow },
            playerOrder: 1,
            totalPlayers: 3);

        Assert.Equal(2, result.CurrentRoundNumber);
        Assert.Equal(2, result.CurrentTurnPlayerOrder);
        Assert.Null(result.SelectedCategoryId);
        Assert.Empty(result.Guesses);
    }

    [Fact]
    public void AddGuess_KeepsRoundActiveWhenTargetHasNotBeenReached()
    {
        var service = new LobbyStateService();
        var state = service.StartGame("ABC123", firstPlayerOrder: 1);
        state.RoundTargetWordCount = 2;
        service.SetCategory("ABC123", new LobbyCategorySelection
        {
            CategoryId = 7,
            CategoryName = "Animals",
            Difficulty = "easy"
        }, playerOrder: 1);

        var result = service.AddGuess(
            "ABC123",
            new LobbyGuess { Word = "wrong", Correct = false, SubmittedBy = "Host", CreatedAt = DateTime.UtcNow },
            playerOrder: 1,
            totalPlayers: 3);

        Assert.Equal(1, result.CurrentRoundNumber);
        Assert.Equal(1, result.CurrentTurnPlayerOrder);
        Assert.Equal(7, result.SelectedCategoryId);
        Assert.Single(result.Guesses);
        Assert.Equal(1, result.Guesses[0].RoundNumber);
    }
}
