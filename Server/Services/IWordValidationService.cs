namespace Server.Services;

public interface IWordValidationService
{
    Task<WordValidationResult> ValidateWordsAsync(int categoryId, IEnumerable<string> submittedWords, CancellationToken cancellationToken = default);
    string NormalizeWord(string word);
}
