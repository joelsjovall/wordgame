using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Data.Entities;

namespace Server.Services;

public class GameService
{
  private readonly AppDbContext _db;
  private readonly IWordValidationService _validator;

  public GameService(AppDbContext db, IWordValidationService validator)
  {
    _db = db;
    _validator = validator;
  }

  public async Task<ValidatedWord> SubmitWordAsync(
      int roundId,
      int userId,
      string submittedWord,
      CancellationToken cancellationToken = default)
  {
    var round = await _db.Rounds
        .Include(r => r.Game)
            .ThenInclude(g => g.Players)
        .Include(r => r.Category)
        .FirstAsync(r => r.Id == roundId, cancellationToken);

    var player = round.Game.Players.First(p => p.UserId == userId);

    // Validera ordet med ditt befintliga WordValidationService
    var validation = await _validator.ValidateWordsAsync(
        round.CategoryId,
        new[] { submittedWord },   // <-- IEnumerable<string>
        cancellationToken
    );

    var result = validation.Words.First();

    // Poänglogik
    if (result.IsValid && !result.IsDuplicate)
    {
      player.Score += round.Category.Points;
    }
    else
    {
      player.Score -= 1;
    }

    // Spara ordet
    _db.SubmittedWords.Add(new SubmittedWord
    {
      OriginalWord = submittedWord,
      NormalizedWord = result.NormalizedWord,
      IsValid = result.IsValid,
      MatchedCategoryWordId = result.MatchedCategoryWordId,
      CreatedAt = DateTime.UtcNow
    });

    await _db.SaveChangesAsync(cancellationToken);

    return result;
  }
}
