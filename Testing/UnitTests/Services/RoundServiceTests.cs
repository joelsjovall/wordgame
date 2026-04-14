using Server.Data.Entities;
using Server.Services;
using Xunit;

namespace WordGame.UnitTests.Services;

public class RoundServiceTests
{
    [Fact]
    public void PlaceBid_AllowsFirstBidInBiddingRound()
    {
        var service = new RoundService();
        var round = CreateRound();

        var result = service.PlaceBid(round, playerId: 5, bidCount: 3);

        Assert.Equal(3, round.HighestBidCount);
        Assert.Equal(5, round.HighestBidPlayerId);
        Assert.Single(round.Bids);
        Assert.Equal(3, result.Bid.BidCount);
        Assert.Equal(5, result.Bid.PlayerId);
    }

    [Fact]
    public void PlaceBid_RequiresBidToBeHigherThanCurrentHighestBid()
    {
        var service = new RoundService();
        var round = CreateRound(highestBidCount: 4, highestBidPlayerId: 2);

        var exception = Assert.Throws<InvalidOperationException>(() => service.PlaceBid(round, playerId: 3, bidCount: 4));

        Assert.Equal("A new bid must be higher than the current highest bid.", exception.Message);
    }

    [Fact]
    public void PlaceBid_UpdatesHighestBidWhenBidIsHigher()
    {
        var service = new RoundService();
        var round = CreateRound(highestBidCount: 4, highestBidPlayerId: 2);

        service.PlaceBid(round, playerId: 3, bidCount: 6);

        Assert.Equal(6, round.HighestBidCount);
        Assert.Equal(3, round.HighestBidPlayerId);
        Assert.Single(round.Bids);
        Assert.Equal(6, round.Bids.Single().BidCount);
    }

    [Fact]
    public void PlaceBid_RejectsBidWhenRoundIsNotInBiddingStatus()
    {
        var service = new RoundService();
        var round = CreateRound(status: "challenge_active");

        var exception = Assert.Throws<InvalidOperationException>(() => service.PlaceBid(round, playerId: 2, bidCount: 5));

        Assert.Equal("Bids can only be placed while the round is in bidding status.", exception.Message);
    }

    [Fact]
    public void PlaceBid_RejectsBidCountLessThanOrEqualToZero()
    {
        var service = new RoundService();
        var round = CreateRound();

        Assert.Throws<ArgumentOutOfRangeException>(() => service.PlaceBid(round, playerId: 2, bidCount: 0));
    }

    private static Round CreateRound(
        string status = "bidding",
        int? highestBidCount = null,
        int? highestBidPlayerId = null)
    {
        return new Round
        {
            Id = 1,
            GameId = 10,
            CategoryId = 20,
            RoundNumber = 1,
            Status = status,
            HighestBidCount = highestBidCount,
            HighestBidPlayerId = highestBidPlayerId,
            CreatedAt = DateTime.UtcNow
        };
    }
}
