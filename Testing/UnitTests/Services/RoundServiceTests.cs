using Server.Data.Entities;
using Server.Data.Repositories;
using Server.Services;
using Xunit;
//importerar det vi behöver (entities, repositories, services och xunit)

namespace WordGame.UnitTests.Services;

public class RoundServiceTests  // innehåller unit tests för logiken för rundor och bud
{
    [Fact]  //testet körs en gång
    public void PlaceBid_AllowsFirstBidInBiddingRound()
    //testet kontrollerar att första budet får läggas när rundan är i bidding status
    {
        var service = CreateService();
        var round = CreateRound();  //skapar en låtsasrunda

        var result = service.PlaceBid(round, playerId: 5, bidCount: 3);
        //player 5 lägger bud att den kan skriva 3 ord 

        Assert.Equal(3, round.HighestBidCount);
        Assert.Equal(5, round.HighestBidPlayerId);
        //kontrollerar att sidan uppdaterade det
        Assert.Single(round.Bids);
        //kollar att budhistoriken innehåller exakt 1 bud 
        Assert.Equal(3, result.Bid.BidCount);
        Assert.Equal(5, result.Bid.PlayerId);
    }   //kontrollerar att resultaten innehåller rätt bud och rätt spelare

    [Fact]
    public void PlaceBid_RequiresBidToBeHigherThanCurrentHighestBid()
    //detta test kontrollerar att man inte får lägga samma eller lägre bud än det högsta budet
    {
        var service = CreateService();
        var round = CreateRound(highestBidCount: 4, highestBidPlayerId: 2);
        //runda där spelare 2 redan lagt budet 4 

        var exception = Assert.Throws<InvalidOperationException>(() => service.PlaceBid(round, playerId: 3, bidCount: 4));
        //spelare 3 försöker buda 4 (samma som redan budats)

        Assert.Equal("A new bid must be higher than the current highest bid.", exception.Message);  //blir därför fel
    }

    [Fact]
    public void PlaceBid_UpdatesHighestBidWhenBidIsHigher()
    //om ett bud är högre än förra, ska det högsta budet uppdateras
    {
        var service = CreateService();
        var round = CreateRound(highestBidCount: 4, highestBidPlayerId: 2);
        //spelare 2 har högsta budet på 4 just nu

        service.PlaceBid(round, playerId: 3, bidCount: 6);
        //spelare 3 lägger bud på 6 (högre) 

        Assert.Equal(6, round.HighestBidCount);
        Assert.Equal(3, round.HighestBidPlayerId);
        //kontrollerar att budet har uppdaterats
        Assert.Single(round.Bids);
        Assert.Equal(6, round.Bids.Single().BidCount);
        //kontrollerar att budet sparades i budhistoriken
    }

    [Fact]
    public void PlaceBid_RejectsBidWhenRoundIsNotInBiddingStatus()
    //kontrollerar att man bara får buda i rätt rundstatus
    {
        var service = CreateService();
        var round = CreateRound(status: "challenge_active");
        //någon har blivit utmanad/bullshittad, rundan är alltså inte längre i budgivning

        var exception = Assert.Throws<InvalidOperationException>(() => service.PlaceBid(round, playerId: 2, bidCount: 5));
        //spelare 2 försöker lägga budet 5

        Assert.Equal("Bids can only be placed while the round is in bidding status.", exception.Message);   //går ej
    }

    [Fact]
    public void PlaceBid_RejectsBidCountLessThanOrEqualToZero()
    //bud som är 0 eller mindre ska stoppas
    {
        var service = CreateService();
        var round = CreateRound();
        //skapar runda

        Assert.Throws<ArgumentOutOfRangeException>(() => service.PlaceBid(round, playerId: 2, bidCount: 0));
        //försöker buda 0, går inte. måste vara minst 1
    }

    [Fact]
    public async Task PlaceBidAsync_LoadsRoundAndSavesValidBid()
    //testet kontrollerar async flödet där RoundService hämtar rundan via repository och sparar budet
    {
        var round = CreateRound();
        var repository = new FakeRoundRepository(round);
        var service = new RoundService(repository);
        //skapar fake repository med en runda 

        var result = await service.PlaceBidAsync(round.Id, playerId: 4, bidCount: 2);
        //hämta rundan med id 1, spelare 4 lägger budet 2

        Assert.Equal(2, result.Round.HighestBidCount);
        Assert.Equal(4, result.Round.HighestBidPlayerId);
        //kontrollerar att sidan uppdaterades med rätt bud och spelare
        Assert.True(repository.SaveWasCalled);
        //kontrollerar att service bad repositoryn att spara ändringen
    }


    private static RoundService CreateService()
    {
        return new RoundService(new FakeRoundRepository(null));
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

    private sealed class FakeRoundRepository(Round? round) : IRoundRepository
    {
        private readonly Round? _round = round;

        public bool SaveWasCalled { get; private set; }

        public Task<Round?> GetByIdAsync(int roundId, CancellationToken cancellationToken = default)
        {
            if (_round?.Id == roundId)
            {
                return Task.FromResult<Round?>(_round);
            }

            return Task.FromResult<Round?>(null);
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SaveWasCalled = true;
            return Task.CompletedTask;
        }
    }
}
