using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Server.Data;
using Server.Data.Entities;
using WordGame.ApiTests.Fixtures;
using Xunit;

namespace WordGame.ApiTests.Endpoints;

public class GamesEndpointsTests(CustomWebApplicationFactory factory) : IClassFixture<CustomWebApplicationFactory>
{
    [Fact]
    public async Task CreateGame_CreatesHostUserAndLobby()
    {
        await ResetDatabaseAsync();

        using var client = CreateClient();

        var response = await client.PostAsJsonAsync("/api/games", new
        {
            username = "HostPlayer"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CreateOrJoinGameResponse>();
        Assert.NotNull(payload);
        Assert.True(payload.GameId > 0);
        Assert.Equal(payload.GameId.ToString(), payload.Code);
        Assert.True(payload.UserId > 0);
        Assert.Equal("HostPlayer", payload.Username);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var game = await dbContext.Games.FindAsync(payload.GameId);
        Assert.NotNull(game);
        Assert.Equal("waiting_for_players", game.Status);
        Assert.Equal(payload.UserId, game.HostUserId);

        var hostPlayer = dbContext.GamePlayers.Single(x => x.GameId == payload.GameId);
        Assert.Equal(payload.UserId, hostPlayer.UserId);
        Assert.Equal(1, hostPlayer.TurnOrder);
        Assert.Equal(3, hostPlayer.Lives);
        Assert.True(hostPlayer.IsReady);
    }

    [Fact]
    public async Task JoinGame_AddsSecondPlayer_AndPlayersEndpointReturnsLobbyOrder()
    {
        await ResetDatabaseAsync();

        using var client = CreateClient();

        var createResponse = await client.PostAsJsonAsync("/api/games", new
        {
            username = "HostPlayer"
        });
        var createdGame = await createResponse.Content.ReadFromJsonAsync<CreateOrJoinGameResponse>();

        var joinResponse = await client.PostAsJsonAsync("/api/games/join", new
        {
            username = "GuestPlayer",
            code = createdGame!.Code
        });

        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);

        var joinedGame = await joinResponse.Content.ReadFromJsonAsync<CreateOrJoinGameResponse>();
        Assert.NotNull(joinedGame);
        Assert.Equal(createdGame.GameId, joinedGame.GameId);
        Assert.NotEqual(createdGame.UserId, joinedGame.UserId);

        var playersResponse = await client.GetAsync($"/api/games/{createdGame.GameId}/players");

        Assert.Equal(HttpStatusCode.OK, playersResponse.StatusCode);

        var players = await playersResponse.Content.ReadFromJsonAsync<List<PlayerDto>>();
        Assert.NotNull(players);
        Assert.Equal(2, players.Count);
        Assert.Equal("HostPlayer", players[0].Username);
        Assert.Equal(1, players[0].PlayerOrder);
        Assert.True(players[0].IsReady);
        Assert.Equal("GuestPlayer", players[1].Username);
        Assert.Equal(2, players[1].PlayerOrder);
        Assert.False(players[1].IsReady);
    }

    [Fact]
    public async Task JoinGame_ReturnsBadRequest_WhenUsernameAlreadyExistsInLobby()
    {
        await ResetDatabaseAsync();

        using var client = CreateClient();

        var createResponse = await client.PostAsJsonAsync("/api/games", new
        {
            username = "HostPlayer"
        });
        var createdGame = await createResponse.Content.ReadFromJsonAsync<CreateOrJoinGameResponse>();

        var joinResponse = await client.PostAsJsonAsync("/api/games/join", new
        {
            username = "hostplayer",
            code = createdGame!.Code
        });

        Assert.Equal(HttpStatusCode.BadRequest, joinResponse.StatusCode);
    }

    [Fact]
    public async Task StartRound_CreatesRound_AndCurrentRoundEndpointReturnsIt()
    {
        await ResetDatabaseAsync();

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Categories.Add(new Category
        {
            Name = "Animals",
            Difficulty = "easy",
            Points = 1
        });
        await dbContext.SaveChangesAsync();
        var categoryId = dbContext.Categories.Single().Id;

        using var client = CreateClient();

        var createResponse = await client.PostAsJsonAsync("/api/games", new
        {
            username = "HostPlayer"
        });
        var createdGame = await createResponse.Content.ReadFromJsonAsync<CreateOrJoinGameResponse>();

        var startRoundResponse = await client.PostAsJsonAsync($"/api/games/{createdGame!.GameId}/rounds/start", new
        {
            categoryId,
            currentPlayerId = createdGame.UserId
        });

        Assert.Equal(HttpStatusCode.Created, startRoundResponse.StatusCode);

        var startedRound = await startRoundResponse.Content.ReadFromJsonAsync<StartRoundResponse>();
        Assert.NotNull(startedRound);
        Assert.True(startedRound.RoundId > 0);
        Assert.Equal(categoryId, startedRound.CategoryId);
        Assert.Equal("challenge_active", startedRound.Status);

        var currentRoundResponse = await client.GetAsync($"/api/games/{createdGame.GameId}/current-round");

        Assert.Equal(HttpStatusCode.OK, currentRoundResponse.StatusCode);

        var currentRound = await currentRoundResponse.Content.ReadFromJsonAsync<CurrentRoundResponse>();
        Assert.NotNull(currentRound);
        Assert.Equal(createdGame.GameId, currentRound.GameId);
        Assert.Equal(startedRound.RoundId, currentRound.CurrentRoundId);
    }

    [Fact]
    public async Task StartRound_AllowsLegacyDirectStart_WhenLobbyPlayersAreNotReady()
    {
        await ResetDatabaseAsync();

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Categories.Add(new Category
        {
            Name = "Animals",
            Difficulty = "easy",
            Points = 1
        });
        await dbContext.SaveChangesAsync();
        var categoryId = dbContext.Categories.Single().Id;

        using var client = CreateClient();

        var createResponse = await client.PostAsJsonAsync("/api/games", new
        {
            username = "HostPlayer"
        });
        var createdGame = await createResponse.Content.ReadFromJsonAsync<CreateOrJoinGameResponse>();

        var joinResponse = await client.PostAsJsonAsync("/api/games/join", new
        {
            username = "GuestPlayer",
            code = createdGame!.Code
        });
        var joinedGame = await joinResponse.Content.ReadFromJsonAsync<CreateOrJoinGameResponse>();

        var startRoundResponse = await client.PostAsJsonAsync($"/api/games/{createdGame.GameId}/rounds/start", new
        {
            categoryId,
            currentPlayerId = joinedGame!.UserId
        });

        Assert.Equal(HttpStatusCode.Created, startRoundResponse.StatusCode);

        var startedRound = await startRoundResponse.Content.ReadFromJsonAsync<StartRoundResponse>();
        Assert.NotNull(startedRound);
        Assert.Equal(createdGame.GameId, startedRound.GameId);
        Assert.Equal(categoryId, startedRound.CategoryId);

        using var verificationScope = factory.Services.CreateScope();
        var verificationDbContext = verificationScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persistedRound = await verificationDbContext.Rounds.FindAsync(startedRound.RoundId);
        Assert.NotNull(persistedRound);
        Assert.Equal(2, persistedRound.HighestBidCount);
    }

    private HttpClient CreateClient()
    {
        return factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
    }

    private async Task ResetDatabaseAsync()
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();
    }

    public sealed class CreateOrJoinGameResponse
    {
        public int GameId { get; set; }
        public string Code { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
    }

    public sealed class PlayerDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public int Score { get; set; }
        public int PlayerOrder { get; set; }
        public bool IsReady { get; set; }
    }

    public sealed class StartRoundResponse
    {
        public int GameId { get; set; }
        public int RoundId { get; set; }
        public int RoundNumber { get; set; }
        public int CategoryId { get; set; }
        public string Status { get; set; } = string.Empty;
        public int CurrentRoundId { get; set; }
    }

    public sealed class CurrentRoundResponse
    {
        public int GameId { get; set; }
        public int CurrentRoundId { get; set; }
    }
}
