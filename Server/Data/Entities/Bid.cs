namespace Server.Data.Entities;

public class Bid
{
    public int Id { get; set; }
    public int RoundId { get; set; }
    public int PlayerId { get; set; }
    public int BidCount { get; set; }
    public DateTime CreatedAt { get; set; }

    public Round? Round { get; set; }
    public User? Player { get; set; }
}
