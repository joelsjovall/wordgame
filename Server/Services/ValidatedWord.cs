namespace Server.Services;

public class ValidatedWord
{
    public string OriginalWord { get; init; } = string.Empty;
    public string NormalizedWord { get; init; } = string.Empty;
    public bool IsValid { get; init; }
    public bool IsDuplicate { get; init; }
    public int? MatchedCategoryWordId { get; init; }
}
