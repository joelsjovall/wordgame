namespace Server.Services;

public class WordValidationResult
{
    public int CategoryId { get; init; }
    public int ValidUniqueWordCount { get; init; }
    public IReadOnlyList<ValidatedWord> Words { get; init; } = [];
}
