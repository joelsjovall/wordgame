using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Data.Entities;

namespace Server.Services;

public class GameFlowService(
    AppDbContext dbContext,
    GameTurnStateService gameTurnStateService,
    GameConcurrencyService gameConcurrencyService,
    RoundLiveDraftService roundLiveDraftService)
{
    private const int BidDecisionSeconds = 30;
    private const int DefaultTimeoutBidCount = 1;
    private const int ChallengeBonusPoints = 50;

    public async Task<GameStateSnapshot?> GetGameStateAsync(int gameId, CancellationToken cancellationToken = default)
    {
        var gameLock = gameConcurrencyService.GetGameLock(gameId);
        await gameLock.WaitAsync(cancellationToken);

        try
        {
            var game = await dbContext.Games
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == gameId, cancellationToken);

            if (game is null)
            {
                return null;
            }

            var players = await dbContext.GamePlayers
                .AsNoTracking()
                .Where(x => x.GameId == gameId)
                .Join(
                    dbContext.Users.AsNoTracking(),
                    gamePlayer => gamePlayer.UserId,
                    user => user.Id,
                    (gamePlayer, user) => new GameStatePlayer
                    {
                        UserId = gamePlayer.UserId,
                        Username = user.Username,
                        TurnOrder = gamePlayer.TurnOrder,
                        IsReady = gamePlayer.IsReady
                    })
                .OrderBy(x => x.TurnOrder)
                .ToListAsync(cancellationToken);

            if (players.Count == 0)
            {
                throw new InvalidOperationException("This game has no players.");
            }

            if (game.CurrentRoundId.HasValue)
            {
                await ProcessRoundTimeoutsAsync(game.CurrentRoundId.Value, cancellationToken);

                var roundReadyPlayerIds = players
                    .Where(player => player.IsReady)
                    .Select(player => player.UserId)
                    .ToList();

                var round = await dbContext.Rounds
                    .AsNoTracking()
                    .Include(x => x.Bids)
                    .Include(x => x.Challenges)
                    .FirstOrDefaultAsync(x => x.Id == game.CurrentRoundId.Value, cancellationToken);

                if (round is not null && !string.Equals(round.Status, "completed", StringComparison.OrdinalIgnoreCase))
                {
                    var deadlineUtc = GetRoundDeadlineUtc(round);
                    var activePlayerName = players.FirstOrDefault(player => player.UserId == round.CurrentPlayerId)?.Username;

                    return new GameStateSnapshot
                    {
                        GameId = gameId,
                        CurrentRoundId = round.Id,
                        Phase = round.Status,
                        ActivePlayerId = round.CurrentPlayerId,
                        ActivePlayerName = activePlayerName,
                        DeadlineUtc = deadlineUtc,
                        SecondsRemaining = GetSecondsRemaining(deadlineUtc),
                        ReadyPlayerIds = roundReadyPlayerIds,
                        ReadyPlayersCount = roundReadyPlayerIds.Count,
                        TotalPlayers = players.Count,
                        AllPlayersReady = roundReadyPlayerIds.Count == players.Count
                    };
                }
            }

            var readyPlayerIds = players
                .Where(player => player.IsReady)
                .Select(player => player.UserId)
                .ToList();
            var allPlayersReady = readyPlayerIds.Count == players.Count;
            var starterPlayerId = await GetNextRoundStarterPlayerIdAsync(gameId, players, cancellationToken);
            var starterPlayerName = players.FirstOrDefault(player => player.UserId == starterPlayerId)?.Username;

            if (!allPlayersReady)
            {
                gameTurnStateService.Clear(gameId);

                return new GameStateSnapshot
                {
                    GameId = gameId,
                    CurrentRoundId = game.CurrentRoundId,
                    Phase = "round_start_pending",
                    ActivePlayerId = starterPlayerId,
                    ActivePlayerName = starterPlayerName,
                    ReadyPlayerIds = readyPlayerIds,
                    ReadyPlayersCount = readyPlayerIds.Count,
                    TotalPlayers = players.Count,
                    AllPlayersReady = false
                };
            }

            var orderedPlayers = players
                .Select(player => new GamePlayer
                {
                    UserId = player.UserId,
                    TurnOrder = player.TurnOrder
                })
                .ToList();

            var categorySelection = gameTurnStateService.ResolveCategorySelection(gameId, orderedPlayers);
            if (categorySelection.DeadlineUtc <= DateTime.UtcNow)
            {
                var timedOutRound = await StartTimedOutCategoryRoundAsync(game, orderedPlayers, categorySelection.ActivePlayerId, cancellationToken);
                var timedOutActivePlayerName = players.FirstOrDefault(player => player.UserId == timedOutRound.CurrentPlayerId)?.Username;

                return new GameStateSnapshot
                {
                    GameId = gameId,
                    CurrentRoundId = timedOutRound.Id,
                    Phase = timedOutRound.Status,
                    ActivePlayerId = timedOutRound.CurrentPlayerId,
                    ActivePlayerName = timedOutActivePlayerName,
                    DeadlineUtc = GetRoundDeadlineUtc(timedOutRound),
                    SecondsRemaining = GetSecondsRemaining(GetRoundDeadlineUtc(timedOutRound)),
                    ReadyPlayerIds = readyPlayerIds,
                    ReadyPlayersCount = readyPlayerIds.Count,
                    TotalPlayers = players.Count,
                    AllPlayersReady = true
                };
            }

            var categoryPlayerName = players.FirstOrDefault(player => player.UserId == categorySelection.ActivePlayerId)?.Username;

            return new GameStateSnapshot
            {
                GameId = gameId,
                CurrentRoundId = game.CurrentRoundId,
                Phase = "category_selection",
                ActivePlayerId = categorySelection.ActivePlayerId,
                ActivePlayerName = categoryPlayerName,
                DeadlineUtc = categorySelection.DeadlineUtc,
                SecondsRemaining = GetSecondsRemaining(categorySelection.DeadlineUtc),
                ReadyPlayerIds = readyPlayerIds,
                ReadyPlayersCount = readyPlayerIds.Count,
                TotalPlayers = players.Count,
                AllPlayersReady = true
            };
        }
        finally
        {
            gameLock.Release();
        }
    }

    public async Task<Round?> ProcessRoundTimeoutsAsync(int roundId, CancellationToken cancellationToken = default)
    {
        var roundLock = gameConcurrencyService.GetRoundLock(roundId);
        await roundLock.WaitAsync(cancellationToken);

        try
        {
            var round = await dbContext.Rounds
                .Include(x => x.Category)
                .Include(x => x.Bids)
                .Include(x => x.Challenges)
                .FirstOrDefaultAsync(x => x.Id == roundId, cancellationToken);

            if (round is null)
            {
                return null;
            }

            if (string.Equals(round.Status, "bidding", StringComparison.OrdinalIgnoreCase))
            {
                var biddingDeadlineUtc = GetRoundDeadlineUtc(round);
                if (biddingDeadlineUtc <= DateTime.UtcNow &&
                    round.CurrentPlayerId.HasValue &&
                    round.HighestBidPlayerId.HasValue &&
                    round.HighestBidCount.HasValue &&
                    !round.Challenges.Any(challenge => challenge.ResolvedAt == null))
                {
                    round.Challenges.Add(new Challenge
                    {
                        RoundId = round.Id,
                        ChallengedPlayerId = round.HighestBidPlayerId.Value,
                        CallerPlayerId = round.CurrentPlayerId.Value,
                        RequiredWordCount = round.HighestBidCount.Value,
                        TimeLimitSeconds = 60,
                        Status = "active",
                        CreatedAt = DateTime.UtcNow
                    });

                    round.Status = "challenge_active";
                    round.CurrentPlayerId = round.HighestBidPlayerId.Value;

                    await dbContext.SaveChangesAsync(cancellationToken);
                }
            }

            if (string.Equals(round.Status, "challenge_active", StringComparison.OrdinalIgnoreCase))
            {
                var activeChallenge = round.Challenges
                    .Where(challenge => challenge.ResolvedAt == null)
                    .OrderByDescending(challenge => challenge.CreatedAt)
                    .FirstOrDefault();

                if (activeChallenge is not null &&
                    activeChallenge.CreatedAt.AddSeconds(activeChallenge.TimeLimitSeconds) <= DateTime.UtcNow)
                {
                    var validUniqueWordCount = await dbContext.SubmittedWords
                        .AsNoTracking()
                        .Where(word => word.ChallengeId == activeChallenge.Id && word.IsValid)
                        .Select(word => word.NormalizedWord)
                        .Distinct()
                        .CountAsync(cancellationToken);

                    var succeeded = validUniqueWordCount >= activeChallenge.RequiredWordCount;
                    activeChallenge.Status = "failed";
                    activeChallenge.ResolvedAt = DateTime.UtcNow;

                    var pointsPerWord = round.Category?.Points ?? 1;
                    var awardedWordPoints = validUniqueWordCount * pointsPerWord;

                    var challengedPlayer = await dbContext.GamePlayers
                        .FirstOrDefaultAsync(
                            x => x.GameId == round.GameId && x.UserId == activeChallenge.ChallengedPlayerId,
                            cancellationToken);

                    if (challengedPlayer is not null && awardedWordPoints > 0)
                    {
                        challengedPlayer.Score += awardedWordPoints;
                    }

                    if (succeeded)
                    {
                        activeChallenge.Status = "succeeded";

                        if (challengedPlayer is not null)
                        {
                            challengedPlayer.Score += ChallengeBonusPoints;
                        }
                    }
                    else
                    {
                        activeChallenge.Status = "failed";

                        var callerPlayer = await dbContext.GamePlayers
                            .FirstOrDefaultAsync(
                                x => x.GameId == round.GameId && x.UserId == activeChallenge.CallerPlayerId,
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
                    round.CurrentPlayerId = GetNextPlayerId(orderedPlayers, activeChallenge.ChallengedPlayerId);

                    await ResetPlayersReadyStateAsync(round.GameId, cancellationToken);
                    roundLiveDraftService.ClearRound(round.Id);

                    await dbContext.SaveChangesAsync(cancellationToken);
                }
            }

            return round;
        }
        finally
        {
            roundLock.Release();
        }
    }

    public async Task<Round> StartRoundAsync(
        Game game,
        IReadOnlyList<GamePlayer> orderedPlayers,
        int currentPlayerId,
        int categoryId,
        int openingBidCount,
        CancellationToken cancellationToken = default)
    {
        if (dbContext.Entry(game).State == EntityState.Detached)
        {
            game = await dbContext.Games.FirstAsync(x => x.Id == game.Id, cancellationToken);
        }

        var latestRoundNumber = await dbContext.Rounds
            .Where(x => x.GameId == game.Id)
            .Select(x => (int?)x.RoundNumber)
            .MaxAsync(cancellationToken) ?? 0;

        var isSinglePlayerRound = orderedPlayers.Count <= 1;
        var nextPlayerId = orderedPlayers.Count > 1
            ? orderedPlayers[(orderedPlayers.ToList().FindIndex(player => player.UserId == currentPlayerId) + 1) % orderedPlayers.Count].UserId
            : currentPlayerId;

        var bidCreatedAt = DateTime.UtcNow;
        var round = new Round
        {
            GameId = game.Id,
            CategoryId = categoryId,
            RoundNumber = latestRoundNumber + 1,
            Status = isSinglePlayerRound ? "challenge_active" : "bidding",
            CurrentPlayerId = isSinglePlayerRound ? currentPlayerId : nextPlayerId,
            HighestBidCount = openingBidCount,
            HighestBidPlayerId = currentPlayerId,
            CreatedAt = bidCreatedAt,
            Bids =
            {
                new Bid
                {
                    PlayerId = currentPlayerId,
                    BidCount = openingBidCount,
                    CreatedAt = bidCreatedAt
                }
            }
        };

        if (isSinglePlayerRound)
        {
            round.Challenges.Add(new Challenge
            {
                ChallengedPlayerId = currentPlayerId,
                CallerPlayerId = currentPlayerId,
                RequiredWordCount = openingBidCount,
                TimeLimitSeconds = 60,
                Status = "active",
                CreatedAt = bidCreatedAt
            });
        }

        dbContext.Rounds.Add(round);
        await dbContext.SaveChangesAsync(cancellationToken);

        await ResetPlayersReadyStateAsync(game.Id, cancellationToken);

        game.CurrentRoundId = round.Id;
        game.Status = "in_progress";
        gameTurnStateService.Clear(game.Id);

        await dbContext.SaveChangesAsync(cancellationToken);

        return round;
    }

    private async Task<Round> StartTimedOutCategoryRoundAsync(
        Game game,
        IReadOnlyList<GamePlayer> orderedPlayers,
        int timedOutPlayerId,
        CancellationToken cancellationToken)
    {
        var randomCategoryId = await dbContext.Categories
            .AsNoTracking()
            .OrderBy(_ => Guid.NewGuid())
            .Select(category => (int?)category.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (!randomCategoryId.HasValue)
        {
            throw new InvalidOperationException("No categories are available.");
        }

        return await StartRoundAsync(
            game,
            orderedPlayers,
            timedOutPlayerId,
            randomCategoryId.Value,
            DefaultTimeoutBidCount,
            cancellationToken);
    }

    public async Task ResetPlayersReadyStateAsync(int gameId, CancellationToken cancellationToken = default)
    {
        var gamePlayers = await dbContext.GamePlayers
            .Where(player => player.GameId == gameId)
            .ToListAsync(cancellationToken);

        foreach (var gamePlayer in gamePlayers)
        {
            gamePlayer.IsReady = false;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> GetNextRoundStarterPlayerIdAsync(
        int gameId,
        IReadOnlyList<GameStatePlayer>? players = null,
        CancellationToken cancellationToken = default)
    {
        var orderedPlayers = players?.OrderBy(player => player.TurnOrder).ToList() ?? await dbContext.GamePlayers
            .AsNoTracking()
            .Where(player => player.GameId == gameId)
            .Join(
                dbContext.Users.AsNoTracking(),
                gamePlayer => gamePlayer.UserId,
                user => user.Id,
                (gamePlayer, user) => new GameStatePlayer
                {
                    UserId = gamePlayer.UserId,
                    Username = user.Username,
                    TurnOrder = gamePlayer.TurnOrder,
                    IsReady = gamePlayer.IsReady
                })
            .OrderBy(player => player.TurnOrder)
            .ToListAsync(cancellationToken);

        if (orderedPlayers.Count == 0)
        {
            throw new InvalidOperationException("This game has no players.");
        }

        var latestRound = await dbContext.Rounds
            .AsNoTracking()
            .Where(round => round.GameId == gameId)
            .OrderByDescending(round => round.RoundNumber)
            .FirstOrDefaultAsync(cancellationToken);

        return latestRound?.CurrentPlayerId ?? orderedPlayers[0].UserId;
    }

    public static DateTime? GetRoundDeadlineUtc(Round round)
    {
        if (string.Equals(round.Status, "bidding", StringComparison.OrdinalIgnoreCase))
        {
            var lastBidCreatedAt = round.Bids
                .OrderByDescending(bid => bid.CreatedAt)
                .Select(bid => (DateTime?)bid.CreatedAt)
                .FirstOrDefault() ?? round.CreatedAt;

            return lastBidCreatedAt.AddSeconds(BidDecisionSeconds);
        }

        if (string.Equals(round.Status, "challenge_active", StringComparison.OrdinalIgnoreCase))
        {
            var activeChallenge = round.Challenges
                .Where(challenge => challenge.ResolvedAt == null)
                .OrderByDescending(challenge => challenge.CreatedAt)
                .FirstOrDefault();

            return activeChallenge is null
                ? null
                : activeChallenge.CreatedAt.AddSeconds(activeChallenge.TimeLimitSeconds);
        }

        return null;
    }

    public static int? GetSecondsRemaining(DateTime? deadlineUtc)
    {
        if (!deadlineUtc.HasValue)
        {
            return null;
        }

        return Math.Max(0, (int)Math.Ceiling((deadlineUtc.Value - DateTime.UtcNow).TotalSeconds));
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
}

public sealed class GameStateSnapshot
{
    public int GameId { get; set; }
    public int? CurrentRoundId { get; set; }
    public string Phase { get; set; } = string.Empty;
    public int? ActivePlayerId { get; set; }
    public string? ActivePlayerName { get; set; }
    public DateTime? DeadlineUtc { get; set; }
    public int? SecondsRemaining { get; set; }
    public List<int> ReadyPlayerIds { get; set; } = [];
    public int ReadyPlayersCount { get; set; }
    public int TotalPlayers { get; set; }
    public bool AllPlayersReady { get; set; }
}

public sealed class GameStatePlayer
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public int TurnOrder { get; set; }
    public bool IsReady { get; set; }
}
