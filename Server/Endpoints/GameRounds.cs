using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Data.Entities;
using Server.Services;

namespace Server.Endpoints;

public static class GameRoundsEndpoints
{
    public static RouteGroupBuilder MapGameRoundsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/rounds");

        group.MapPost("/{roundId:int}/challenges", async (
            int roundId,
            CreateChallengeRequest request,
            AppDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (request.ChallengedPlayerId <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["challengedPlayerId"] = ["ChallengedPlayerId must be greater than 0."]
                });
            }

            if (request.CallerPlayerId <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["callerPlayerId"] = ["CallerPlayerId must be greater than 0."]
                });
            }

            if (request.RequiredWordCount <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["requiredWordCount"] = ["RequiredWordCount must be greater than 0."]
                });
            }

            if (request.TimeLimitSeconds <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["timeLimitSeconds"] = ["TimeLimitSeconds must be greater than 0."]
                });
            }

            var round = await dbContext.Rounds.FirstOrDefaultAsync(x => x.Id == roundId, cancellationToken);
            if (round is null)
            {
                return Results.NotFound(new { message = $"Round {roundId} was not found." });
            }

            var challengerExists = await dbContext.GamePlayers
                .AsNoTracking()
                .AnyAsync(x => x.GameId == round.GameId && x.UserId == request.CallerPlayerId, cancellationToken);

            var challengedExists = await dbContext.GamePlayers
                .AsNoTracking()
                .AnyAsync(x => x.GameId == round.GameId && x.UserId == request.ChallengedPlayerId, cancellationToken);

            if (!challengerExists || !challengedExists)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["players"] = ["Both caller and challenged player must belong to this game."]
                });
            }

            var existingChallenge = await dbContext.Challenges
                .AsNoTracking()
                .AnyAsync(
                    x => x.RoundId == roundId &&
                         x.ChallengedPlayerId == request.ChallengedPlayerId &&
                         x.ResolvedAt == null,
                    cancellationToken);

            if (existingChallenge)
            {
                return Results.Conflict(new
                {
                    message = "An active challenge already exists for this player in this round."
                });
            }

            var challenge = new Challenge
            {
                RoundId = roundId,
                ChallengedPlayerId = request.ChallengedPlayerId,
                CallerPlayerId = request.CallerPlayerId,
                RequiredWordCount = request.RequiredWordCount,
                TimeLimitSeconds = request.TimeLimitSeconds,
                Status = "active",
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Challenges.Add(challenge);

            // Keep round state aligned with gameplay progression.
            round.Status = "challenge_active";

            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/rounds/{roundId}/challenges/{challenge.Id}", new
            {
                challenge.Id,
                challenge.RoundId,
                challenge.ChallengedPlayerId,
                challenge.CallerPlayerId,
                challenge.RequiredWordCount,
                challenge.TimeLimitSeconds,
                challenge.Status,
                challenge.CreatedAt
            });
        });

        group.MapPost("/{roundId:int}/submissions", async (
            int roundId,
            SubmitRoundWordsRequest request,
            AppDbContext dbContext,
            IWordValidationService wordValidationService,
            CancellationToken cancellationToken) =>
        {
            if (request.PlayerId <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["playerId"] = ["PlayerId must be greater than 0."]
                });
            }

            if (request.Words is null || request.Words.Count == 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["words"] = ["At least one submitted word is required."]
                });
            }

            var round = await dbContext.Rounds
                .Include(x => x.Category)
                .FirstOrDefaultAsync(x => x.Id == roundId, cancellationToken);

            if (round is null)
            {
                return Results.NotFound(new { message = $"Round {roundId} was not found." });
            }

            var challenge = await dbContext.Challenges
                .Where(x => x.RoundId == roundId &&
                            x.ChallengedPlayerId == request.PlayerId &&
                            x.ResolvedAt == null)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (challenge is null)
            {
                return Results.Conflict(new
                {
                    message = "No active challenge was found for this player in the selected round."
                });
            }

            var validationResult = await wordValidationService.ValidateWordsAsync(
                round.CategoryId,
                request.Words,
                cancellationToken);

            var submittedWords = validationResult.Words
                .Select(word => new SubmittedWord
                {
                    ChallengeId = challenge.Id,
                    OriginalWord = word.OriginalWord,
                    NormalizedWord = word.NormalizedWord,
                    IsValid = word.IsValid && !word.IsDuplicate,
                    MatchedCategoryWordId = word.MatchedCategoryWordId,
                    CreatedAt = DateTime.UtcNow
                })
                .ToList();

            dbContext.SubmittedWords.AddRange(submittedWords);

            var succeeded = validationResult.ValidUniqueWordCount >= challenge.RequiredWordCount;
            var pointsPerWord = round.Category?.Points ?? 1;
            var awardedPoints = succeeded ? validationResult.ValidUniqueWordCount * pointsPerWord : 0;

            challenge.Status = succeeded ? "succeeded" : "failed";
            challenge.ResolvedAt = DateTime.UtcNow;

            var gamePlayer = await dbContext.GamePlayers
                .FirstOrDefaultAsync(
                    x => x.GameId == round.GameId && x.UserId == request.PlayerId,
                    cancellationToken);

            if (gamePlayer is not null && awardedPoints > 0)
            {
                gamePlayer.Score += awardedPoints;
            }

            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Ok(new
            {
                roundId = round.Id,
                playerId = request.PlayerId,
                challengeId = challenge.Id,
                requiredWordCount = challenge.RequiredWordCount,
                validUniqueWordCount = validationResult.ValidUniqueWordCount,
                succeeded,
                awardedPoints,
                words = validationResult.Words.Select(word => new
                {
                    originalWord = word.OriginalWord,
                    normalizedWord = word.NormalizedWord,
                    isValid = word.IsValid,
                    isDuplicate = word.IsDuplicate,
                    isAccepted = word.IsValid && !word.IsDuplicate
                })
            });
        });

        group.MapGet("/{roundId:int}/results", async (int roundId, AppDbContext dbContext, CancellationToken cancellationToken) =>
        {
            var round = await dbContext.Rounds
                .Include(x => x.Category)
                .FirstOrDefaultAsync(x => x.Id == roundId, cancellationToken);

            if (round is null)
            {
                return Results.NotFound(new { message = $"Round {roundId} was not found." });
            }

            var gamePlayers = await dbContext.GamePlayers
                .AsNoTracking()
                .Where(x => x.GameId == round.GameId)
                .Join(
                    dbContext.Users.AsNoTracking(),
                    gamePlayer => gamePlayer.UserId,
                    user => user.Id,
                    (gamePlayer, user) => new
                    {
                        gamePlayer.UserId,
                        user.Username,
                        gamePlayer.Score
                    })
                .OrderByDescending(x => x.Score)
                .ToListAsync(cancellationToken);

            var challenges = await dbContext.Challenges
                .AsNoTracking()
                .Where(x => x.RoundId == roundId)
                .GroupJoin(
                    dbContext.SubmittedWords.AsNoTracking(),
                    challenge => challenge.Id,
                    submittedWord => submittedWord.ChallengeId,
                    (challenge, submittedWords) => new
                    {
                        challenge.Id,
                        challenge.ChallengedPlayerId,
                        challenge.RequiredWordCount,
                        challenge.Status,
                        ValidUniqueWordCount = submittedWords
                            .Where(word => word.IsValid)
                            .Select(word => word.NormalizedWord)
                            .Distinct()
                            .Count()
                    })
                .ToListAsync(cancellationToken);

            return Results.Ok(new
            {
                roundId = round.Id,
                gameId = round.GameId,
                category = new
                {
                    round.CategoryId,
                    categoryName = round.Category?.Name,
                    pointsPerWord = round.Category?.Points
                },
                players = gamePlayers,
                challenges
            });
        });

        return group;
    }

    public sealed class SubmitRoundWordsRequest
    {
        public int PlayerId { get; set; }
        public List<string> Words { get; set; } = [];
    }

    public sealed class CreateChallengeRequest
    {
        public int ChallengedPlayerId { get; set; }
        public int CallerPlayerId { get; set; }
        public int RequiredWordCount { get; set; }
        public int TimeLimitSeconds { get; set; } = 60;
    }
}
