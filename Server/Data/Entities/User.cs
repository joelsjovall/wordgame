namespace Server.Data.Entities;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public ICollection<GamePlayer> GamePlayers { get; set; } = new List<GamePlayer>();
}
