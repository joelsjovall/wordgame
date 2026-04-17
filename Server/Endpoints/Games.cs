using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Data.Entities;

namespace Server.Endpoints;

public static class GamesEndpoints
{
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
                PlayerOrder = 1,
                Score = 0,
                IsReady = true
            };

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

            var user = new User
            {
                Username = username,
                CreatedAt = DateTime.UtcNow
            };
            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);

            var nextTurnOrder = await dbContext.GamePlayers
                .Where(x => x.GameId == gameId)
                .Select(x => (int?)x.PlayerOrder)
                .MaxAsync(cancellationToken) ?? 0;

            var gamePlayer = new GamePlayer
            {
                GameId = gameId,
                UserId = user.Id,
                PlayerOrder = nextTurnOrder + 1,
                Score = 0,
                IsReady = false
            };
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
                        playerOrder = gamePlayer.PlayerOrder,
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

        group.MapPost("/{gameId:int}/rounds/start", async (
            int gameId,
            StartRoundRequest request,
            AppDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (request.CategoryId <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["categoryId"] = ["CategoryId must be greater than 0."]
                });
            }

            var game = await dbContext.Games.FirstOrDefaultAsync(x => x.Id == gameId, cancellationToken);
            if (game is null)
            {
                return Results.NotFound(new { message = $"Game {gameId} was not found." });
            }

            var categoryExists = await dbContext.Categories
                .AsNoTracking()
                .AnyAsync(x => x.Id == request.CategoryId, cancellationToken);

            if (!categoryExists)
            {
                return Results.NotFound(new { message = $"Category {request.CategoryId} was not found." });
            }

            var latestRoundNumber = await dbContext.Rounds
                .Where(x => x.GameId == gameId)
                .Select(x => (int?)x.RoundNumber)
                .MaxAsync(cancellationToken) ?? 0;

            var round = new Round
            {
                GameId = gameId,
                CategoryId = request.CategoryId,
                RoundNumber = latestRoundNumber + 1,
                Status = "challenge_active",
                CurrentPlayerId = request.CurrentPlayerId > 0 ? request.CurrentPlayerId : null,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Rounds.Add(round);
            await dbContext.SaveChangesAsync(cancellationToken);

            game.CurrentRoundId = round.Id;
            await dbContext.SaveChangesAsync(cancellationToken);

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
}
