namespace Server.Gameplay.DTOs;

public class CompleteLobbyRoundRequest
{
    public string Username { get; set; } = string.Empty;
    public int ExpectedRoundNumber { get; set; }
}
