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

        return new RoundBidResult
        {
            Round = round,
            Bid = bid
        };
    }
}
