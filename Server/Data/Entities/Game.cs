namespace Server.Data.Entities;

public class Game
{
    public int Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public int HostUserId { get; set; }
    public int? CurrentRoundId { get; set; }
    public int? WinnerUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public User? HostUser { get; set; }
    public User? WinnerUser { get; set; }
    public ICollection<GamePlayer> Players { get; set; } = new List<GamePlayer>();
    public ICollection<Round> Rounds { get; set; } = new List<Round>();
}
