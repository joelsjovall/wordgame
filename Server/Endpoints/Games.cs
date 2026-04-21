using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Data.Entities;

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
                TurnOrder = 1,
                Score = 0,
                Lives = 3,
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
                .Select(x => (int?)x.TurnOrder)
                .MaxAsync(cancellationToken) ?? 0;

            var gamePlayer = new GamePlayer
            {
                GameId = gameId,
                UserId = user.Id,
                TurnOrder = nextTurnOrder + 1,
                Score = 0,
                Lives = 3,
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
                        playerOrder = gamePlayer.TurnOrder,
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




        // ⭐ RAISE – spela ord + gå vidare till nästa spelare
        group.MapPost("/{gameId:int}/raise", async (
            int gameId,
            RaiseRequest request,
            AppDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            // 1. Hämta spelet + current round
            var game = await dbContext.Games
                .Include(g => g.Rounds)
                .FirstOrDefaultAsync(g => g.Id == gameId, cancellationToken);

            if (game is null)
                return Results.NotFound(new { message = $"Game {gameId} was not found." });

            if (!game.CurrentRoundId.HasValue)
                return Results.BadRequest(new { message = "Game has no active round." });

            var round = await dbContext.Rounds
                .FirstOrDefaultAsync(r => r.Id == game.CurrentRoundId.Value, cancellationToken);

            if (round is null)
                return Results.NotFound(new { message = "Round not found." });

            // 2. Kolla att det är spelarens tur
            if (round.CurrentPlayerId != request.UserId)
                return Results.BadRequest(new { message = "Not your turn." });

            // 3. Ge poäng (placeholder)
            var player = await dbContext.GamePlayers
                .FirstOrDefaultAsync(p => p.GameId == gameId && p.UserId == request.UserId, cancellationToken);

            if (player is null)
                return Results.BadRequest(new { message = "Player not found in this game." });

            player.Score += 1;

            // 4. Flytta turen till nästa spelare
            var players = await dbContext.GamePlayers
                .Where(p => p.GameId == gameId)
                .OrderBy(p => p.TurnOrder)
                .ToListAsync(cancellationToken);

            var currentIndex = players.FindIndex(p => p.UserId == request.UserId);
            if (currentIndex == -1)
                return Results.BadRequest(new { message = "Current player not found in turn order." });

            var nextIndex = (currentIndex + 1) % players.Count;
            var nextPlayer = players[nextIndex];

            round.CurrentPlayerId = nextPlayer.UserId;

            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Ok(new
            {
                message = "Word played, turn passed.",
                nextPlayerId = nextPlayer.UserId,
                yourScore = player.Score
            });
        });

        // ⭐ CALL BS – utmana förra spelaren
        group.MapPost("/{gameId:int}/callbs", async (
            int gameId,
            CallBsRequest request,
            AppDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var game = await dbContext.Games
                .Include(g => g.Rounds)
                .FirstOrDefaultAsync(g => g.Id == gameId, cancellationToken);

            if (game is null)
                return Results.NotFound(new { message = $"Game {gameId} was not found." });

            if (!game.CurrentRoundId.HasValue)
                return Results.BadRequest(new { message = "Game has no active round." });

            var round = await dbContext.Rounds
                .FirstOrDefaultAsync(r => r.Id == game.CurrentRoundId.Value, cancellationToken);

            if (round is null)
                return Results.NotFound(new { message = "Round not found." });

            // Hämta alla spelare i turordning
            var players = await dbContext.GamePlayers
                .Where(p => p.GameId == gameId)
                .OrderBy(p => p.TurnOrder)
                .ToListAsync(cancellationToken);

            if (!players.Any())
                return Results.BadRequest(new { message = "No players in this game." });

            // Hitta index för current player
            var currentIndex = players.FindIndex(p => p.UserId == round.CurrentPlayerId);
            if (currentIndex == -1)
                return Results.BadRequest(new { message = "Current player not found in turn order." });

            // Förra spelaren
            var previousIndex = (currentIndex - 1 + players.Count) % players.Count;
            var previousPlayer = players[previousIndex];

            var caller = players.FirstOrDefault(p => p.UserId == request.UserId);
            if (caller is null)
                return Results.BadRequest(new { message = "Caller is not in this game." });

            // ⭐ Placeholder: slumpa om det var bluff
            var random = Random.Shared.Next(0, 2);
            var wasBluff = random == 1;

            if (wasBluff)
            {
                previousPlayer.Score -= 2;
            }
            else
            {
                caller.Score -= 2;
            }

            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Ok(new
            {
                message = wasBluff ? "BS was correct!" : "BS was wrong!",
                callerId = caller.UserId,
                previousPlayerId = previousPlayer.UserId,
                callerScore = caller.Score,
                previousPlayerScore = previousPlayer.Score
            });
        });

        return group;
    }

    //  MODELLER



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

    public sealed class RaiseRequest
    {
        public int UserId { get; set; }
        public string Word { get; set; } = string.Empty;
    }

    public sealed class CallBsRequest
    {
        public int UserId { get; set; }
    }
}


