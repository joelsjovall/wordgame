namespace Server.Data.Entities;

public class Challenge
{
    public int Id { get; set; }
    public int RoundId { get; set; }
    public int ChallengedPlayerId { get; set; }
    public int CallerPlayerId { get; set; }
    public int RequiredWordCount { get; set; }
    public int TimeLimitSeconds { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }

    public Round? Round { get; set; }
    public User? ChallengedPlayer { get; set; }
    public User? CallerPlayer { get; set; }
    public ICollection<SubmittedWord> SubmittedWords { get; set; } = new List<SubmittedWord>();
}
