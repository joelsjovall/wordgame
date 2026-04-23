using Server.Data.Entities;
using Server.Data.Repositories;
using Server.Services;
using Xunit;

namespace WordGame.UnitTests.Services;

public class WordValidationServiceTests
{
    [Theory]   // - kör testet med flera olika ord/testdata
               // test 1 - normalisering 

    [InlineData(" Volvo ", "volvo")]
    [InlineData("BMW", "bmw")]
    [InlineData("  Audi", "audi")]
    // testexempel - säger ''Skicka in ordet, förvänta detta resultatet'' 
    //input volvo, expected volvo
    //samma med mellanslag osv

    public void NormalizeWord_TrimsWhitespaceAndIgnoresCase(string input, string expected)

    //tar bort mellanslag och bryr sig inte om stora eller små bokstäver

    {
        var service = CreateService();
        var normalizedWord = service.NormalizeWord(input);
        Assert.Equal(expected, normalizedWord);
    }




    [Fact] // betyder att testet körs 1 gång 
    public async Task ValidateWordsAsync_CountsOnlyUniqueValidWords()
    //räknar bara unika giltiga ord = correct och i rätt kategori
    {

        var service = CreateService(
            //skickar in fake ord som ska fungera som testdatabas

            new CategoryWord { Id = 1, CategoryId = 10, Word = "Volvo", NormalizedWord = "volvo", IsActive = true },

            new CategoryWord { Id = 2, CategoryId = 10, Word = "BMW", NormalizedWord = "bmw", IsActive = true },

            new CategoryWord { Id = 3, CategoryId = 10, Word = "Audi", NormalizedWord = "audi", IsActive = true });


        var result = await service.ValidateWordsAsync(10, [" Volvo ", "BMW", "bmw", "Invalid"]);
        //skickar in spelarens ord och kontrollerar vilka som är giltiga
        //Volvo finns som volvo = giltigt
        //BMW finns = giltigt, bmw finns men BMW har redan använts = dublett 
        //invalid finns inte = ogiltigt

        Assert.Equal(2, result.ValidUniqueWordCount);

        Assert.Collection(
            result.Words,
            first =>        //kollar det första inskickade ordet
            {
                Assert.Equal(" Volvo ", first.OriginalWord);
                Assert.Equal("volvo", first.NormalizedWord);
                //ordet har ''städats'' till ''volvo'' från '' Volvo ''
                Assert.True(first.IsValid); //kollar att ordet är giltigt
                Assert.False(first.IsDuplicate); //kollar att volvo inte är dublett
                Assert.Equal(1, first.MatchedCategoryWordId); //kollar att volvo matchar databasordet med id 1 
            },
            second =>   //andra inskickade ordet
            {
                Assert.Equal("BMW", second.OriginalWord);
                Assert.Equal("bmw", second.NormalizedWord);
                Assert.True(second.IsValid);    //bmw är giltigt
                Assert.False(second.IsDuplicate);   //bmw är inte dublett   
                Assert.Equal(2, second.MatchedCategoryWordId);  //bmw matchar databas id
                //(kontrolleras att bmw är giltigt, inte en dublett och matchar rätt databas-id)
            },
            third =>    //tredje inskickade ordet
            {
                Assert.Equal("bmw", third.OriginalWord);
                Assert.Equal("bmw", third.NormalizedWord);
                Assert.True(third.IsValid); //giltigt ord
                Assert.True(third.IsDuplicate); // är en dublett, bmw finns redan
                Assert.Equal(2, third.MatchedCategoryWordId);   //matchar också databas id

                //kontrollerar att bmw är ett riktigt ord, men markeras som dublett eftersom BMW redan används
            },
            fourth =>   //fjärde inskickade ordet
            {
                Assert.Equal("Invalid", fourth.OriginalWord);
                Assert.Equal("invalid", fourth.NormalizedWord);
                Assert.False(fourth.IsValid);   //ej giltigt
                Assert.False(fourth.IsDuplicate);   //ej dublett
                Assert.Null(fourth.MatchedCategoryWordId);  //matchar inget databasord

                //här kontrolleras att invalid inte är ett giltigt ord och därför inte har något matchande databas-id
            });
    }
    // 1:a testet kontrollerar att ord normaliseras, ett mellanslag tas bort, stora bokstäver blir små
    //2:a testet skapar fake lista och skickar in 4 ord
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

    [Fact]  //vanligt test 
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

//testet kontrollerar att inaktiva ord inte räknas som giltiga genom att skapa 2 testord i samma kategori, en är aktiv och en är inaktiv. Volvo räknas bara eftersom saab har IsActive false

//Just nu är alla ord alltid är aktiva, men senare kanske man vill kunna stänga av vissa ord utan att radera dem.

