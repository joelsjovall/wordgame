namespace Server.Data.Entities;

public class GamePlayer
{
    public int Id { get; set; }
    public int GameId { get; set; }
    public int UserId { get; set; }
    public int TurnOrder { get; set; }
    public int Score { get; set; }
    public int Lives { get; set; }
    public bool IsReady { get; set; }

    public Game? Game { get; set; }
    public User? User { get; set; }
}
