using Server.Data.Entities;
using Server.Data.Repositories;

namespace Server.Services;

public class RoundService(IRoundRepository roundRepository) : IRoundService
{
    private const string BiddingStatus = "bidding";

    public async Task<RoundBidResult> PlaceBidAsync(int roundId, int playerId, int bidCount, CancellationToken cancellationToken = default)
    {
        var round = await roundRepository.GetByIdAsync(roundId, cancellationToken);

        if (round is null)
        {
            throw new KeyNotFoundException($"Round {roundId} was not found.");
        }

        var result = PlaceBid(round, playerId, bidCount);
        await roundRepository.SaveChangesAsync(cancellationToken);

        return result;
    }

    public RoundBidResult PlaceBid(Round round, int playerId, int bidCount)
    {
        ArgumentNullException.ThrowIfNull(round);

        if (!string.Equals(round.Status, BiddingStatus, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Bids can only be placed while the round is in bidding status.");
        }

        if (bidCount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(bidCount), "Bid count must be greater than zero.");
        }

        var gamePlayers = round.Game?.Players
            .OrderBy(gamePlayer => gamePlayer.TurnOrder)
            .ToList() ?? [];

        if (gamePlayers.Count == 0 || gamePlayers.All(gamePlayer => gamePlayer.UserId != playerId))
        {
            throw new InvalidOperationException("Only players in this game can place bids.");
        }

        if (round.CurrentPlayerId.HasValue && round.CurrentPlayerId.Value != playerId)
        {
            throw new InvalidOperationException("It is not this player's turn to bid.");
        }

        if (round.HighestBidCount.HasValue && bidCount <= round.HighestBidCount.Value)
        {
            throw new InvalidOperationException("A new bid must be higher than the current highest bid.");
        }

        var bid = new Bid
        {
            RoundId = round.Id,
            PlayerId = playerId,
            BidCount = bidCount,
            CreatedAt = DateTime.UtcNow
        };

        round.Bids.Add(bid);
        round.HighestBidCount = bidCount;
        round.HighestBidPlayerId = playerId;
        round.CurrentPlayerId = GetNextPlayerId(gamePlayers, playerId);

        return new RoundBidResult
        {
            Round = round,
            Bid = bid
        };
    }

    private static int? GetNextPlayerId(IReadOnlyList<GamePlayer> gamePlayers, int currentPlayerId)
    {
        if (gamePlayers.Count == 0)
        {
            return null;
        }

        var currentIndex = gamePlayers
            .Select((gamePlayer, index) => new { gamePlayer.UserId, Index = index })
            .FirstOrDefault(entry => entry.UserId == currentPlayerId)?.Index ?? -1;

        if (currentIndex < 0)
        {
            return gamePlayers[0].UserId;
        }

        var nextIndex = (currentIndex + 1) % gamePlayers.Count;
        return gamePlayers[nextIndex].UserId;
    }
}
