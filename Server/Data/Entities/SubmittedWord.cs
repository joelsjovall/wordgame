namespace Server.Data.Entities;

public class SubmittedWord
{
    public int Id { get; set; }
    public int ChallengeId { get; set; }
    public int? SubmittedByUserId { get; set; }
    public string OriginalWord { get; set; } = string.Empty;
    public string NormalizedWord { get; set; } = string.Empty;
    public bool IsValid { get; set; }
    public int? MatchedCategoryWordId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Challenge? Challenge { get; set; }
    public CategoryWord? MatchedCategoryWord { get; set; }
}
