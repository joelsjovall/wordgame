using Server.Data.Entities;
using Server.Data.Repositories;
using Server.Services;
using Xunit;

namespace WordGame.UnitTests.Services;

public class WordValidationServiceTests
{
    [Theory]

    [InlineData(" Volvo ", "volvo")]
    [InlineData("BMW", "bmw")]
    [InlineData("  Audi", "audi")]


    public void NormalizeWord_TrimsWhitespaceAndIgnoresCase(string input, string expected)



    {
        var service = CreateService();
        var normalizedWord = service.NormalizeWord(input);
        Assert.Equal(expected, normalizedWord);
    }




    [Fact]
    public async Task ValidateWordsAsync_CountsOnlyUniqueValidWords()

    {

        var service = CreateService(


            new CategoryWord { Id = 1, CategoryId = 10, Word = "Volvo", NormalizedWord = "volvo", IsActive = true },

            new CategoryWord { Id = 2, CategoryId = 10, Word = "BMW", NormalizedWord = "bmw", IsActive = true },

            new CategoryWord { Id = 3, CategoryId = 10, Word = "Audi", NormalizedWord = "audi", IsActive = true });


        var result = await service.ValidateWordsAsync(10, [" Volvo ", "BMW", "bmw", "Invalid"]);


        Assert.Equal(2, result.ValidUniqueWordCount);

        Assert.Collection(
            result.Words,
            first =>
            {
                Assert.Equal(" Volvo ", first.OriginalWord);
                Assert.Equal("volvo", first.NormalizedWord);

                Assert.True(first.IsValid);
                Assert.False(first.IsDuplicate);
                Assert.Equal(1, first.MatchedCategoryWordId);
            },
            second =>
            {
                Assert.Equal("BMW", second.OriginalWord);
                Assert.Equal("bmw", second.NormalizedWord);
                Assert.True(second.IsValid);
                Assert.False(second.IsDuplicate);
                Assert.Equal(2, second.MatchedCategoryWordId);
            },
            third =>
            {
                Assert.Equal("bmw", third.OriginalWord);
                Assert.Equal("bmw", third.NormalizedWord);
                Assert.True(third.IsValid);
                Assert.True(third.IsDuplicate);
                Assert.Equal(2, third.MatchedCategoryWordId);
            },
            fourth =>
            {
                Assert.Equal("Invalid", fourth.OriginalWord);
                Assert.Equal("invalid", fourth.NormalizedWord);
                Assert.False(fourth.IsValid);
                Assert.False(fourth.IsDuplicate);
                Assert.Null(fourth.MatchedCategoryWordId);
            });
    }

    [Fact]
    public async Task ValidateWordsAsync_OnlyUsesWordsFromRequestedCategory()
    {
        var service = CreateService(
            new CategoryWord { Id = 1, CategoryId = 10, Word = "Volvo", NormalizedWord = "volvo", IsActive = true },
            new CategoryWord { Id = 2, CategoryId = 20, Word = "Apple", NormalizedWord = "apple", IsActive = true });


        var result = await service.ValidateWordsAsync(10, ["Volvo", "Apple"]);

        Assert.Equal(1, result.ValidUniqueWordCount);
        Assert.True(result.Words[0].IsValid);
        Assert.False(result.Words[0].IsDuplicate);
        Assert.False(result.Words[1].IsValid);
    }

    [Fact]
    public async Task ValidateWordsAsync_IgnoresInactiveCategoryWords()
    {

        var service = CreateService(
            new CategoryWord { Id = 1, CategoryId = 10, Word = "Volvo", NormalizedWord = "volvo", IsActive = true },
            new CategoryWord { Id = 2, CategoryId = 10, Word = "Saab", NormalizedWord = "saab", IsActive = false });

        var result = await service.ValidateWordsAsync(10, ["Volvo", "Saab"]);

        Assert.Equal(1, result.ValidUniqueWordCount);
        Assert.True(result.Words[0].IsValid);
        Assert.False(result.Words[1].IsValid);
    }

    private static WordValidationService CreateService(params CategoryWord[] categoryWords)
    {
        return new WordValidationService(new FakeCategoryWordRepository(categoryWords));
    }

    private sealed class FakeCategoryWordRepository(IEnumerable<CategoryWord> categoryWords) : ICategoryWordRepository
    {
        private readonly IReadOnlyList<CategoryWord> _categoryWords = categoryWords.ToList();

        public Task<IReadOnlyList<CategoryWord>> GetByCategoryIdAsync(int categoryId, CancellationToken cancellationToken = default)
        {
            IReadOnlyList<CategoryWord> words = _categoryWords
                .Where(categoryWord => categoryWord.CategoryId == categoryId)
                .ToList();
            return Task.FromResult(words);
        }
    }
}


