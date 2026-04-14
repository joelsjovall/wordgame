namespace Server.Data.Entities;

public class Round
{
    public int Id { get; set; }
    public int GameId { get; set; }
    public int CategoryId { get; set; }
    public int RoundNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? CurrentPlayerId { get; set; }
    public int? HighestBidCount { get; set; }
    public int? HighestBidPlayerId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Game? Game { get; set; }
    public Category? Category { get; set; }
    public User? CurrentPlayer { get; set; }
    public User? HighestBidPlayer { get; set; }
    public ICollection<Bid> Bids { get; set; } = new List<Bid>();
    public ICollection<Challenge> Challenges { get; set; } = new List<Challenge>();
}
