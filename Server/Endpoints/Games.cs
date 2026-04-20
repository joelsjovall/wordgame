using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Data.Entities;
using Server.Services;

namespace Server.Endpoints;

public static class GamesEndpoints
{
    private const int MaxPlayersPerGame = 4;

    public static RouteGroupBuilder MapGamesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/games");

        group.MapPost("/", async (CreateGameRequest request, AppDbContext dbContext, CancellationToken cancellationToken) =>
        {
            var username = request.Username?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(username))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["username"] = ["Username is required."]
                });
            }

            var hostUser = new User
            {
                Username = username,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Users.Add(hostUser);
            await dbContext.SaveChangesAsync(cancellationToken);

            var game = new Game
            {
                Status = "waiting_for_players",
                HostUserId = hostUser.Id,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Games.Add(game);
            await dbContext.SaveChangesAsync(cancellationToken);

            var hostGamePlayer = new GamePlayer
            {
                GameId = game.Id,
                UserId = hostUser.Id,
                Score = 0,
                IsReady = false
            };
            SetTurnOrder(hostGamePlayer, 1);
            SetLives(hostGamePlayer, 3);

            dbContext.GamePlayers.Add(hostGamePlayer);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/games/{game.Id}", new
            {
                gameId = game.Id,
                code = game.Id.ToString(),
                userId = hostUser.Id,
                username = hostUser.Username
            });
        });

        group.MapPost("/join", async (JoinGameRequest request, AppDbContext dbContext, CancellationToken cancellationToken) =>
        {
            var username = request.Username?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(username))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["username"] = ["Username is required."]
                });
            }

            if (!int.TryParse(request.Code?.Trim(), out var gameId) || gameId <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["code"] = ["Code must be a valid numeric game id."]
                });
            }

            var game = await dbContext.Games.FirstOrDefaultAsync(x => x.Id == gameId, cancellationToken);
            if (game is null)
            {
                return Results.NotFound(new { message = $"Game {gameId} was not found." });
            }

            var existingPlayers = await dbContext.GamePlayers
                .AsNoTracking()
                .Where(x => x.GameId == gameId)
                .Join(
                    dbContext.Users.AsNoTracking(),
                    gamePlayer => gamePlayer.UserId,
                    user => user.Id,
                    (gamePlayer, user) => new
                    {
                        gamePlayer.Id,
                        user.Username
                    })
                .ToListAsync(cancellationToken);

            if (existingPlayers.Count >= MaxPlayersPerGame)
            {
                return Results.BadRequest(new { message = "This lobby is full." });
            }

            if (existingPlayers.Any(x => string.Equals(x.Username, username, StringComparison.OrdinalIgnoreCase)))
            {
                return Results.BadRequest(new { message = "That username is already taken in this lobby." });
            }

            var user = new User
            {
                Username = username,
                CreatedAt = DateTime.UtcNow
            };
            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);

            var nextTurnOrder = await dbContext.GamePlayers
                .Where(x => x.GameId == gameId)
                .Select(x => (int?)EF.Property<int>(x, "TurnOrder"))
                .MaxAsync(cancellationToken) ?? 0;

            var gamePlayer = new GamePlayer
            {
                GameId = gameId,
                UserId = user.Id,
                Score = 0,
                IsReady = false
            };
            SetTurnOrder(gamePlayer, nextTurnOrder + 1);
            SetLives(gamePlayer, 3);
            dbContext.GamePlayers.Add(gamePlayer);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Ok(new
            {
                gameId,
                code = gameId.ToString(),
                userId = user.Id,
                username = user.Username
            });
        });

        group.MapGet("/{gameId:int}/players", async (int gameId, AppDbContext dbContext, CancellationToken cancellationToken) =>
        {
            var gameExists = await dbContext.Games.AsNoTracking().AnyAsync(x => x.Id == gameId, cancellationToken);
            if (!gameExists)
            {
                return Results.NotFound(new { message = $"Game {gameId} was not found." });
            }

            var players = await dbContext.GamePlayers
                .AsNoTracking()
                .Where(x => x.GameId == gameId)
                .Join(
                    dbContext.Users.AsNoTracking(),
                    gamePlayer => gamePlayer.UserId,
                    user => user.Id,
                    (gamePlayer, user) => new
                    {
                        id = user.Id,
                        username = user.Username,
                        score = gamePlayer.Score,
                        playerOrder = EF.Property<int>(gamePlayer, "TurnOrder"),
                        isReady = gamePlayer.IsReady
                    })
                .OrderBy(x => x.playerOrder)
                .ToListAsync(cancellationToken);

            return Results.Ok(players);
        });

        group.MapGet("/{gameId:int}/current-round", async (int gameId, AppDbContext dbContext, CancellationToken cancellationToken) =>
        {
            var game = await dbContext.Games
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == gameId, cancellationToken);

            if (game is null)
            {
                return Results.NotFound(new { message = $"Game {gameId} was not found." });
            }

            if (!game.CurrentRoundId.HasValue)
            {
                return Results.NotFound(new { message = $"Game {gameId} has no current round." });
            }

            return Results.Ok(new
            {
                gameId = game.Id,
                currentRoundId = game.CurrentRoundId.Value
            });
        });

        group.MapGet("/{gameId:int}/state", async (
            int gameId,
            GameFlowService gameFlowService,
            CancellationToken cancellationToken) =>
        {
            var state = await gameFlowService.GetGameStateAsync(gameId, cancellationToken);
            if (state is null)
            {
                return Results.NotFound(new { message = $"Game {gameId} was not found." });
            }

            return Results.Ok(state);
        });

        group.MapPost("/{gameId:int}/ready", async (
            int gameId,
            MarkPlayerReadyRequest request,
            AppDbContext dbContext,
            GameFlowService gameFlowService,
            GameTurnStateService gameTurnStateService,
            CancellationToken cancellationToken) =>
        {
            if (request.PlayerId <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["playerId"] = ["PlayerId must be greater than 0."]
                });
            }

            var game = await dbContext.Games
                .FirstOrDefaultAsync(x => x.Id == gameId, cancellationToken);

            if (game is null)
            {
                return Results.NotFound(new { message = $"Game {gameId} was not found." });
            }

            if (game.CurrentRoundId.HasValue)
            {
                await gameFlowService.ProcessRoundTimeoutsAsync(game.CurrentRoundId.Value, cancellationToken);

                var currentRound = await dbContext.Rounds
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == game.CurrentRoundId.Value, cancellationToken);

                if (currentRound is not null && !string.Equals(currentRound.Status, "completed", StringComparison.OrdinalIgnoreCase))
                {
                    return Results.Conflict(new { message = "You cannot ready up while a round is still active." });
                }
            }

            var gamePlayer = await dbContext.GamePlayers
                .FirstOrDefaultAsync(player => player.GameId == gameId && player.UserId == request.PlayerId, cancellationToken);

            if (gamePlayer is null)
            {
                return Results.NotFound(new { message = "Player was not found in this game." });
            }

            gamePlayer.IsReady = true;
            await dbContext.SaveChangesAsync(cancellationToken);

            var orderedPlayers = await dbContext.GamePlayers
                .AsNoTracking()
                .Where(player => player.GameId == gameId)
                .OrderBy(player => EF.Property<int>(player, "TurnOrder"))
                .ToListAsync(cancellationToken);

            if (orderedPlayers.Count > 0 && orderedPlayers.All(player => player.IsReady))
            {
                var starterPlayerId = await gameFlowService.GetNextRoundStarterPlayerIdAsync(gameId, cancellationToken: cancellationToken);
                gameTurnStateService.StartCategorySelection(gameId, starterPlayerId);
            }

            var state = await gameFlowService.GetGameStateAsync(gameId, cancellationToken);
            return Results.Ok(state);
        });

        group.MapPost("/{gameId:int}/rounds/start", async (
            int gameId,
            StartRoundRequest request,
            AppDbContext dbContext,
            GameFlowService gameFlowService,
            GameTurnStateService gameTurnStateService,
            CancellationToken cancellationToken) =>
        {
            if (request.CategoryId <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["categoryId"] = ["CategoryId must be greater than 0."]
                });
            }

            if (request.OpeningBidCount <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["openingBidCount"] = ["OpeningBidCount must be greater than 0."]
                });
            }

            var game = await dbContext.Games.FirstOrDefaultAsync(x => x.Id == gameId, cancellationToken);
            if (game is null)
            {
                return Results.NotFound(new { message = $"Game {gameId} was not found." });
            }

            var orderedPlayers = await dbContext.GamePlayers
                .AsNoTracking()
                .Where(x => x.GameId == gameId)
                .OrderBy(x => EF.Property<int>(x, "TurnOrder"))
                .ToListAsync(cancellationToken);

            if (orderedPlayers.Count == 0)
            {
                return Results.BadRequest(new { message = "This game has no players." });
            }

            Round? previousRound = null;
            if (game.CurrentRoundId.HasValue)
            {
                await gameFlowService.ProcessRoundTimeoutsAsync(game.CurrentRoundId.Value, cancellationToken);

                previousRound = await dbContext.Rounds
                    .FirstOrDefaultAsync(x => x.Id == game.CurrentRoundId.Value, cancellationToken);

                if (previousRound is not null &&
                    !string.Equals(previousRound.Status, "completed", StringComparison.OrdinalIgnoreCase))
                {
                    return Results.Conflict(new { message = "Finish the current round before starting a new one." });
                }
            }

            if (request.CurrentPlayerId.GetValueOrDefault() <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["currentPlayerId"] = ["CurrentPlayerId is required to start a round."]
                });
            }

            var expectedStartingPlayerId = previousRound?.CurrentPlayerId ?? orderedPlayers[0].UserId;
            var currentPlayerId = request.CurrentPlayerId.GetValueOrDefault();
            var categorySelectionState = gameTurnStateService.ResolveCategorySelection(gameId, orderedPlayers);
            if (!orderedPlayers.All(player => player.IsReady))
            {
                return Results.Conflict(new { message = "All players must click start before the round can begin." });
            }

            expectedStartingPlayerId = categorySelectionState.ActivePlayerId;

            if (categorySelectionState.DeadlineUtc <= DateTime.UtcNow)
            {
                return Results.Conflict(new
                {
                    message = "Category selection timed out. Refresh game state and try again."
                });
            }

            if (currentPlayerId != expectedStartingPlayerId)
            {
                return Results.BadRequest(new
                {
                    message = "It is not this player's turn to start the next round.",
                    expectedPlayerId = expectedStartingPlayerId
                });
            }

            var categoryExists = await dbContext.Categories
                .AsNoTracking()
                .AnyAsync(x => x.Id == request.CategoryId, cancellationToken);

            if (!categoryExists)
            {
                return Results.NotFound(new { message = $"Category {request.CategoryId} was not found." });
            }

            var round = await gameFlowService.StartRoundAsync(
                game,
                orderedPlayers,
                currentPlayerId,
                request.CategoryId,
                request.OpeningBidCount,
                cancellationToken);

            return Results.Created($"/api/rounds/{round.Id}", new
            {
                gameId = game.Id,
                roundId = round.Id,
                round.RoundNumber,
                round.CategoryId,
                round.Status,
                game.CurrentRoundId
            });
        });

        return group;
    }

    public sealed class StartRoundRequest
    {
        public int CategoryId { get; set; }
        public int? CurrentPlayerId { get; set; }
        public int OpeningBidCount { get; set; }
    }

    public sealed class MarkPlayerReadyRequest
    {
        public int PlayerId { get; set; }
    }

    public sealed class CreateGameRequest
    {
        public string Username { get; set; } = string.Empty;
    }

    public sealed class JoinGameRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
    }

    private static void SetTurnOrder(GamePlayer gamePlayer, int value)
    {
        var property = typeof(GamePlayer).GetProperty("TurnOrder") ?? typeof(GamePlayer).GetProperty("PlayerOrder");
        property?.SetValue(gamePlayer, value);
    }

    private static void SetLives(GamePlayer gamePlayer, int value)
    {
        var property = typeof(GamePlayer).GetProperty("Lives");
        property?.SetValue(gamePlayer, value);
    }
}
