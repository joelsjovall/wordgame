using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Data.Entities;
using Server.Services;

namespace Server.Endpoints;

public static class GameRoundsEndpoints
{
    private const int ChallengeBonusPoints = 50;

    public static RouteGroupBuilder MapGameRoundsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/rounds");

        group.MapPost("/{roundId:int}/challenges", async (
            int roundId,
            CreateChallengeRequest request,
            AppDbContext dbContext,
            GameFlowService gameFlowService,
            CancellationToken cancellationToken) =>
        {
            await gameFlowService.ProcessRoundTimeoutsAsync(roundId, cancellationToken);

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

            if (!string.Equals(round.Status, "bidding", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Conflict(new { message = "A challenge can only be created during bidding." });
            }

            if (!round.CurrentPlayerId.HasValue || round.CurrentPlayerId.Value != request.CallerPlayerId)
            {
                return Results.Conflict(new { message = "It is not this player's turn to challenge." });
            }

            if (!round.HighestBidPlayerId.HasValue || !round.HighestBidCount.HasValue)
            {
                return Results.Conflict(new { message = "There is no active bid to challenge yet." });
            }

            if (request.ChallengedPlayerId != round.HighestBidPlayerId.Value)
            {
                return Results.Conflict(new { message = "The challenged player must be the current highest bidder." });
            }

            if (request.RequiredWordCount != round.HighestBidCount.Value)
            {
                return Results.Conflict(new { message = "The challenge word count must match the current highest bid." });
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
            round.CurrentPlayerId = challenge.ChallengedPlayerId;

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
            GameFlowService gameFlowService,
            GameTurnStateService gameTurnStateService,
            CancellationToken cancellationToken) =>
        {
            await gameFlowService.ProcessRoundTimeoutsAsync(roundId, cancellationToken);

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

            if (!string.Equals(round.Status, "challenge_active", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Conflict(new { message = "Words can only be submitted while a challenge is active." });
            }

            if (!round.CurrentPlayerId.HasValue || round.CurrentPlayerId.Value != request.PlayerId)
            {
                return Results.Conflict(new { message = "It is not this player's turn to submit words." });
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
                    SubmittedByUserId = request.PlayerId,
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
            var awardedPoints = validationResult.ValidUniqueWordCount * pointsPerWord;

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

            if (succeeded && gamePlayer is not null)
            {
                gamePlayer.Score += ChallengeBonusPoints;
                awardedPoints += ChallengeBonusPoints;
            }
            else if (!succeeded)
            {
                var callerPlayer = await dbContext.GamePlayers
                    .FirstOrDefaultAsync(
                        x => x.GameId == round.GameId && x.UserId == challenge.CallerPlayerId,
                        cancellationToken);

                if (callerPlayer is not null)
                {
                    callerPlayer.Score += ChallengeBonusPoints;
                }
            }

            var orderedPlayers = await dbContext.GamePlayers
                .AsNoTracking()
                .Where(x => x.GameId == round.GameId)
                .OrderBy(x => x.TurnOrder)
                .ToListAsync(cancellationToken);

            round.Status = "completed";
            round.CurrentPlayerId = GetNextPlayerId(orderedPlayers, request.PlayerId);

            if (round.CurrentPlayerId.HasValue)
            {
                await gameFlowService.ResetPlayersReadyStateAsync(round.GameId, cancellationToken);
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

        group.MapGet("/{roundId:int}/results", async (
            int roundId,
            AppDbContext dbContext,
            GameFlowService gameFlowService,
            CancellationToken cancellationToken) =>
        {
            await gameFlowService.ProcessRoundTimeoutsAsync(roundId, cancellationToken);

            var round = await dbContext.Rounds
                .Include(x => x.Category)
                .Include(x => x.Bids)
                .Include(x => x.Challenges)
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
                        gamePlayer.Score,
                        gamePlayer.TurnOrder
                    })
                .OrderBy(x => x.TurnOrder)
                .ToListAsync(cancellationToken);

            var playerNamesById = gamePlayers.ToDictionary(player => player.UserId, player => player.Username);

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
                roundNumber = round.RoundNumber,
                status = round.Status,
                currentPlayerId = round.CurrentPlayerId,
                currentPlayerName = round.CurrentPlayerId.HasValue && playerNamesById.TryGetValue(round.CurrentPlayerId.Value, out var currentPlayerName)
                    ? currentPlayerName
                    : null,
                deadlineUtc = GameFlowService.GetRoundDeadlineUtc(round),
                secondsRemaining = GameFlowService.GetSecondsRemaining(GameFlowService.GetRoundDeadlineUtc(round)),
                highestBidCount = round.HighestBidCount,
                highestBidPlayerId = round.HighestBidPlayerId,
                highestBidPlayerName = round.HighestBidPlayerId.HasValue && playerNamesById.TryGetValue(round.HighestBidPlayerId.Value, out var highestBidPlayerName)
                    ? highestBidPlayerName
                    : null,
                players = gamePlayers,
                challenges
            });
        });

        group.MapPost("/{roundId:int}/validate-word", async (
            int roundId,
            ValidateRoundWordRequest request,
            AppDbContext dbContext,
            IWordValidationService wordValidationService,
            GameFlowService gameFlowService,
            CancellationToken cancellationToken) =>
        {
            await gameFlowService.ProcessRoundTimeoutsAsync(roundId, cancellationToken);

            if (request.PlayerId <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["playerId"] = ["PlayerId must be greater than 0."]
                });
            }

            var word = request.Word?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(word))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["word"] = ["Word is required."]
                });
            }

            var round = await dbContext.Rounds
                .Include(x => x.Category)
                .FirstOrDefaultAsync(x => x.Id == roundId, cancellationToken);

            if (round is null)
            {
                return Results.NotFound(new { message = $"Round {roundId} was not found." });
            }

            if (!string.Equals(round.Status, "challenge_active", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Conflict(new { message = "Words can only be validated while a challenge is active." });
            }

            if (!round.CurrentPlayerId.HasValue || round.CurrentPlayerId.Value != request.PlayerId)
            {
                return Results.Conflict(new { message = "It is not this player's turn to submit words." });
            }

            var validationWords = request.ExistingWords ?? [];
            var activeChallenge = await dbContext.Challenges
                .AsNoTracking()
                .Where(x => x.RoundId == roundId &&
                            x.ChallengedPlayerId == request.PlayerId &&
                            x.ResolvedAt == null)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (activeChallenge is null)
            {
                return Results.Conflict(new { message = "No active challenge was found for this player in the selected round." });
            }

            var persistedAcceptedWords = await dbContext.SubmittedWords
                .AsNoTracking()
                .Where(wordEntry => wordEntry.ChallengeId == activeChallenge.Id && wordEntry.IsValid)
                .Select(wordEntry => wordEntry.OriginalWord)
                .ToListAsync(cancellationToken);

            validationWords = persistedAcceptedWords;
            validationWords.Add(word);

            var validationResult = await wordValidationService.ValidateWordsAsync(
                round.CategoryId,
                validationWords,
                cancellationToken);

            var latestWord = validationResult.Words.Last();

            if (latestWord.IsValid && !latestWord.IsDuplicate)
            {
                dbContext.SubmittedWords.Add(new SubmittedWord
                {
                    ChallengeId = activeChallenge.Id,
                    SubmittedByUserId = request.PlayerId,
                    OriginalWord = latestWord.OriginalWord,
                    NormalizedWord = latestWord.NormalizedWord,
                    IsValid = true,
                    MatchedCategoryWordId = latestWord.MatchedCategoryWordId,
                    CreatedAt = DateTime.UtcNow
                });

                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return Results.Ok(new
            {
                originalWord = latestWord.OriginalWord,
                normalizedWord = latestWord.NormalizedWord,
                isValid = latestWord.IsValid,
                isDuplicate = latestWord.IsDuplicate,
                isAccepted = latestWord.IsValid && !latestWord.IsDuplicate
            });
        });

        return group;
    }

    private static int? GetNextPlayerId(IReadOnlyList<GamePlayer> orderedPlayers, int currentPlayerId)
    {
        if (orderedPlayers.Count == 0)
        {
            return null;
        }

        var currentIndex = orderedPlayers
            .Select((player, index) => new { player.UserId, Index = index })
            .FirstOrDefault(entry => entry.UserId == currentPlayerId)?.Index ?? -1;

        if (currentIndex < 0)
        {
            return orderedPlayers[0].UserId;
        }

        var nextIndex = (currentIndex + 1) % orderedPlayers.Count;
        return orderedPlayers[nextIndex].UserId;
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

    public sealed class ValidateRoundWordRequest
    {
        public int PlayerId { get; set; }
        public string Word { get; set; } = string.Empty;
        public List<string> ExistingWords { get; set; } = [];
    }
}
