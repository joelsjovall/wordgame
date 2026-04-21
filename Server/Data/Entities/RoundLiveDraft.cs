namespace Server.Data.Entities;

public class RoundLiveDraft
{
    public int Id { get; set; }
    public int RoundId { get; set; }
    public int PlayerId { get; set; }
    public string CurrentInput { get; set; } = string.Empty;
    public string PendingWordsJson { get; set; } = "[]";
    public DateTime UpdatedAt { get; set; }

    public Round? Round { get; set; }
    public User? Player { get; set; }
}
