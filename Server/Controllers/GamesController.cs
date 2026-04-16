using Microsoft.AspNetCore.Mvc;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/games")]
public class GamesController : ControllerBase
{
  private readonly GameService _gameService;

  public GamesController(GameService gameService)
  {
    _gameService = gameService;
  }

  [HttpPost("{roundId:int}/submit/{userId:int}")]
  public async Task<IActionResult> SubmitWord(
      int roundId,
      int userId,
      [FromBody] string word,
      CancellationToken cancellationToken)
  {
    var result = await _gameService.SubmitWordAsync(roundId, userId, word, cancellationToken);
    return Ok(result);
  }
}
