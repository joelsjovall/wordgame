using Microsoft.AspNetCore.Mvc;
using Server.Gameplay.DTOs;
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

  [HttpPost("create")]
  public async Task<IActionResult> CreateGame([FromBody] CreateGameRequest request, CancellationToken cancellationToken)
  {
    try
    {
      var game = await _gameService.CreateGameAsync(request.Username, cancellationToken);

      return Ok(new
      {
        code = game.Id.ToString(),
        game.Id,
        game.HostUserId,
        players = game.Players
            .OrderBy(player => player.TurnOrder)
            .Select(player => new
            {
              player.Id,
              username = player.User?.Username ?? string.Empty,
              player.Score,
              player.Lives,
              player.TurnOrder,
              player.IsReady
            })
      });
    }
    catch (ArgumentException exception)
    {
      return BadRequest(new { message = exception.Message });
    }
  }

  [HttpPost("join")]
  public async Task<IActionResult> JoinGame([FromBody] JoinGameRequest request, CancellationToken cancellationToken)
  {
    try
    {
      var game = await _gameService.JoinGameAsync(request.Username, request.Code, cancellationToken);

      return Ok(new
      {
        code = game.Id.ToString(),
        game.Id,
        players = game.Players
            .OrderBy(player => player.TurnOrder)
            .Select(player => new
            {
              player.Id,
              username = player.User?.Username ?? string.Empty,
              player.Score,
              player.Lives,
              player.TurnOrder,
              player.IsReady
            })
      });
    }
    catch (ArgumentException exception)
    {
      return BadRequest(new { message = exception.Message });
    }
    catch (KeyNotFoundException exception)
    {
      return NotFound(new { message = exception.Message });
    }
    catch (InvalidOperationException exception)
    {
      return BadRequest(new { message = exception.Message });
    }
  }

  [HttpGet("{code}/players")]
  public async Task<IActionResult> GetPlayers(string code, CancellationToken cancellationToken)
  {
    try
    {
      var players = await _gameService.GetPlayersAsync(code, cancellationToken);

      return Ok(players.Select(player => new
      {
        player.Id,
        username = player.User?.Username ?? string.Empty,
        player.Score,
        player.Lives,
        player.TurnOrder,
        player.IsReady
      }));
    }
    catch (ArgumentException exception)
    {
      return BadRequest(new { message = exception.Message });
    }
    catch (KeyNotFoundException exception)
    {
      return NotFound(new { message = exception.Message });
    }
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
