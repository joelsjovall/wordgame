using Server.Data.Entities;

namespace Server.Services;

public class RoundService : IRoundService
{
    private const string BiddingStatus = "bidding";

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
