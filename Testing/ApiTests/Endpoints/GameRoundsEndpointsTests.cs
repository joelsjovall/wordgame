using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Server.Data;
using Server.Data.Entities;
using WordGame.ApiTests.Fixtures;
using Xunit;

namespace WordGame.ApiTests.Endpoints;

public class GameRoundsEndpointsTests(CustomWebApplicationFactory factory) : IClassFixture<CustomWebApplicationFactory>
{
    [Fact]
    public async Task CreateChallenge_CreatesActiveChallenge_ForPlayersInTheSameGame()
    {
        var scenario = await SeedRoundScenarioAsync();

        using var client = CreateClient();

        var response = await client.PostAsJsonAsync($"/api/rounds/{scenario.RoundId}/challenges", new
        {
            challengedPlayerId = scenario.GuestUserId,
            callerPlayerId = scenario.HostUserId,
            requiredWordCount = 2,
            timeLimitSeconds = 45
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CreateChallengeResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.Id > 0);
        Assert.Equal(scenario.RoundId, payload.RoundId);
        Assert.Equal(scenario.GuestUserId, payload.ChallengedPlayerId);
        Assert.Equal(scenario.HostUserId, payload.CallerPlayerId);
        Assert.Equal("active", payload.Status);
    }

    [Fact]
    public async Task SubmitRoundWords_StoresSubmission_UpdatesScore_AndResultsExposeRoundData()
    {
        var scenario = await SeedRoundScenarioAsync();

        using var client = CreateClient();

        var challengeResponse = await client.PostAsJsonAsync($"/api/rounds/{scenario.RoundId}/challenges", new
        {
            challengedPlayerId = scenario.GuestUserId,
            callerPlayerId = scenario.HostUserId,
            requiredWordCount = 2,
            timeLimitSeconds = 60
        });
        var challenge = await challengeResponse.Content.ReadFromJsonAsync<CreateChallengeResponse>();

        var submissionResponse = await client.PostAsJsonAsync($"/api/rounds/{scenario.RoundId}/submissions", new
        {
            playerId = scenario.GuestUserId,
            words = new[] { "apple", "banana", "apple" }
        });

        Assert.Equal(HttpStatusCode.OK, submissionResponse.StatusCode);

        var submission = await submissionResponse.Content.ReadFromJsonAsync<RoundSubmissionResponse>();
        Assert.NotNull(submission);
        Assert.Equal(scenario.RoundId, submission.RoundId);
        Assert.Equal(scenario.GuestUserId, submission.PlayerId);
        Assert.Equal(challenge!.Id, submission.ChallengeId);
        Assert.Equal(2, submission.RequiredWordCount);
        Assert.Equal(2, submission.ValidUniqueWordCount);
        Assert.True(submission.Succeeded);
        Assert.Equal(4, submission.AwardedPoints);
        Assert.Equal(3, submission.Words.Count);
        Assert.Equal(2, submission.Words.Count(word => word.IsAccepted));

        var resultsResponse = await client.GetAsync($"/api/rounds/{scenario.RoundId}/results");

        Assert.Equal(HttpStatusCode.OK, resultsResponse.StatusCode);

        var results = await resultsResponse.Content.ReadFromJsonAsync<RoundResultsResponse>();
        Assert.NotNull(results);
        Assert.Equal(scenario.RoundId, results.RoundId);
        Assert.Equal(scenario.GameId, results.GameId);
        Assert.Equal("Fruits", results.Category.CategoryName);
        Assert.Equal(2, results.Category.PointsPerWord);

        var topPlayer = Assert.Single(results.Players, player => player.UserId == scenario.GuestUserId);
        Assert.Equal("GuestPlayer", topPlayer.Username);
        Assert.Equal(4, topPlayer.Score);

        var trackedChallenge = Assert.Single(results.Challenges);
        Assert.Equal(scenario.GuestUserId, trackedChallenge.ChallengedPlayerId);
        Assert.Equal("succeeded", trackedChallenge.Status);
        Assert.Equal(2, trackedChallenge.ValidUniqueWordCount);
    }

    [Fact]
    public async Task RoundDrafts_CanBeSharedLive_AndAreClearedAfterSubmission()
    {
        var scenario = await SeedRoundScenarioAsync();

        using var client = CreateClient();

        var updateDraftResponse = await client.PutAsJsonAsync($"/api/rounds/{scenario.RoundId}/drafts", new
        {
            playerId = scenario.GuestUserId,
            currentInput = "cher",
            words = new[] { "apple", "banana" }
        });

        Assert.Equal(HttpStatusCode.OK, updateDraftResponse.StatusCode);

        var draftsResponse = await client.GetAsync($"/api/rounds/{scenario.RoundId}/drafts");

        Assert.Equal(HttpStatusCode.OK, draftsResponse.StatusCode);

        var drafts = await draftsResponse.Content.ReadFromJsonAsync<List<RoundDraftDto>>();
        Assert.NotNull(drafts);
        Assert.Equal(2, drafts.Count);

        var guestDraft = Assert.Single(drafts, draft => draft.PlayerId == scenario.GuestUserId);
        Assert.Equal("GuestPlayer", guestDraft.Username);
        Assert.Equal("cher", guestDraft.CurrentInput);
        Assert.Equal(["apple", "banana"], guestDraft.Words);

        var hostDraft = Assert.Single(drafts, draft => draft.PlayerId == scenario.HostUserId);
        Assert.Equal("HostPlayer", hostDraft.Username);
        Assert.Empty(hostDraft.Words);
        Assert.Equal(string.Empty, hostDraft.CurrentInput);

        var challengeResponse = await client.PostAsJsonAsync($"/api/rounds/{scenario.RoundId}/challenges", new
        {
            challengedPlayerId = scenario.GuestUserId,
            callerPlayerId = scenario.HostUserId,
            requiredWordCount = 2,
            timeLimitSeconds = 60
        });

        Assert.Equal(HttpStatusCode.Created, challengeResponse.StatusCode);

        var submissionResponse = await client.PostAsJsonAsync($"/api/rounds/{scenario.RoundId}/submissions", new
        {
            playerId = scenario.GuestUserId,
            words = new[] { "apple", "banana" }
        });

        Assert.Equal(HttpStatusCode.OK, submissionResponse.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, await dbContext.RoundLiveDrafts.CountAsync());
    }

    private HttpClient CreateClient()
    {
        return factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
    }

    private async Task<RoundScenario> SeedRoundScenarioAsync()
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();

        var hostUser = new User { Username = "HostPlayer", CreatedAt = DateTime.UtcNow };
        var guestUser = new User { Username = "GuestPlayer", CreatedAt = DateTime.UtcNow };
        var game = new Game { HostUser = hostUser, Status = "waiting_for_players", CreatedAt = DateTime.UtcNow };
        var category = new Category { Name = "Fruits", Difficulty = "easy", Points = 2 };

        dbContext.Users.AddRange(hostUser, guestUser);
        dbContext.Games.Add(game);
        dbContext.Categories.Add(category);
        await dbContext.SaveChangesAsync();

        dbContext.GamePlayers.AddRange(
            new GamePlayer
            {
                GameId = game.Id,
                UserId = hostUser.Id,
                TurnOrder = 1,
                Score = 0,
                Lives = 3,
                IsReady = true
            },
            new GamePlayer
            {
                GameId = game.Id,
                UserId = guestUser.Id,
                TurnOrder = 2,
                Score = 0,
                Lives = 3,
                IsReady = false
            });

        dbContext.CategoryWords.AddRange(
            new CategoryWord
            {
                CategoryId = category.Id,
                Word = "Apple",
                NormalizedWord = "apple",
                IsActive = true
            },
            new CategoryWord
            {
                CategoryId = category.Id,
                Word = "Banana",
                NormalizedWord = "banana",
                IsActive = true
            });

        var round = new Round
        {
            GameId = game.Id,
            CategoryId = category.Id,
            RoundNumber = 1,
            Status = "challenge_active",
            CurrentPlayerId = guestUser.Id,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Rounds.Add(round);
        await dbContext.SaveChangesAsync();

        game.CurrentRoundId = round.Id;
        await dbContext.SaveChangesAsync();

        return new RoundScenario
        {
            GameId = game.Id,
            RoundId = round.Id,
            HostUserId = hostUser.Id,
            GuestUserId = guestUser.Id
        };
    }

    public sealed class RoundScenario
    {
        public int GameId { get; set; }
        public int RoundId { get; set; }
        public int HostUserId { get; set; }
        public int GuestUserId { get; set; }
    }

    public sealed class CreateChallengeResponse
    {
        public int Id { get; set; }
        public int RoundId { get; set; }
        public int ChallengedPlayerId { get; set; }
        public int CallerPlayerId { get; set; }
        public int RequiredWordCount { get; set; }
        public int TimeLimitSeconds { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public sealed class RoundSubmissionResponse
    {
        public int RoundId { get; set; }
        public int PlayerId { get; set; }
        public int ChallengeId { get; set; }
        public int RequiredWordCount { get; set; }
        public int ValidUniqueWordCount { get; set; }
        public bool Succeeded { get; set; }
        public int AwardedPoints { get; set; }
        public List<SubmittedWordDto> Words { get; set; } = [];
    }

    public sealed class SubmittedWordDto
    {
        public string OriginalWord { get; set; } = string.Empty;
        public string NormalizedWord { get; set; } = string.Empty;
        public bool IsValid { get; set; }
        public bool IsDuplicate { get; set; }
        public bool IsAccepted { get; set; }
    }

    public sealed class RoundResultsResponse
    {
        public int RoundId { get; set; }
        public int GameId { get; set; }
        public CategoryDto Category { get; set; } = new();
        public List<PlayerDto> Players { get; set; } = [];
        public List<ChallengeDto> Challenges { get; set; } = [];
    }

    public sealed class CategoryDto
    {
        public int CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public int? PointsPerWord { get; set; }
    }

    public sealed class PlayerDto
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public int Score { get; set; }
    }

    public sealed class ChallengeDto
    {
        public int Id { get; set; }
        public int ChallengedPlayerId { get; set; }
        public int RequiredWordCount { get; set; }
        public string Status { get; set; } = string.Empty;
        public int ValidUniqueWordCount { get; set; }
    }

    public sealed class RoundDraftDto
    {
        public int PlayerId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string CurrentInput { get; set; } = string.Empty;
        public List<string> Words { get; set; } = [];
    }
}
