using Server.Data.Repositories;

namespace Server.Services;

public class WordValidationService(ICategoryWordRepository categoryWordRepository) : IWordValidationService
{
    public string NormalizeWord(string word)
    {
        return (word ?? string.Empty).Trim().ToLowerInvariant();
    }

    public async Task<WordValidationResult> ValidateWordsAsync(
        int categoryId,
        IEnumerable<string> submittedWords,
        CancellationToken cancellationToken = default)
    {
        var categoryWords = await categoryWordRepository.GetByCategoryIdAsync(categoryId, cancellationToken);
        var validWordsByNormalizedValue = categoryWords
            .Where(categoryWord => !string.IsNullOrWhiteSpace(categoryWord.NormalizedWord))
            .GroupBy(categoryWord => categoryWord.NormalizedWord)
            .ToDictionary(group => group.Key, group => group.First());

        var seenValidWords = new HashSet<string>();
        var validatedWords = new List<ValidatedWord>();

        foreach (var submittedWord in submittedWords)
        {
            var normalizedWord = NormalizeWord(submittedWord);
            var hasMatch = validWordsByNormalizedValue.TryGetValue(normalizedWord, out var matchedCategoryWord);
            var isDuplicate = hasMatch && !seenValidWords.Add(normalizedWord);

            validatedWords.Add(new ValidatedWord
            {
                OriginalWord = submittedWord ?? string.Empty,
                NormalizedWord = normalizedWord,
                IsValid = hasMatch,
                IsDuplicate = isDuplicate,
                MatchedCategoryWordId = matchedCategoryWord?.Id
            });
        }

        return new WordValidationResult
        {
            CategoryId = categoryId,
            ValidUniqueWordCount = seenValidWords.Count,
            Words = validatedWords
        };
    }
}
