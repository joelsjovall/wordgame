namespace Server.Gameplay.DTOs;

public class AddLobbyGuessRequest
{
    public string Word { get; set; } = string.Empty;
    public bool Correct { get; set; }
    public string SubmittedBy { get; set; } = string.Empty;
}
