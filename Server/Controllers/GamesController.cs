using Microsoft.AspNetCore.Mvc;
using Server.Gameplay.DTOs;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/games")]
public class GamesController : ControllerBase
{
  private readonly GameService _gameService;
  private readonly LobbyStateService _lobbyStateService;

  public GamesController(GameService gameService, LobbyStateService lobbyStateService)
  {
    _gameService = gameService;
    _lobbyStateService = lobbyStateService;
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
            .OrderBy(player => player.PlayerOrder)
            .Select(player => new
            {
              player.Id,
              username = player.User?.Username ?? string.Empty,
              player.Score,
              player.PlayerOrder,
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
            .OrderBy(player => player.PlayerOrder)
            .Select(player => new
            {
              player.Id,
              username = player.User?.Username ?? string.Empty,
              player.Score,
              player.PlayerOrder,
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
        player.PlayerOrder,
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

  [HttpGet("{code}/lobby-state")]
  public IActionResult GetLobbyState(string code)
  {
    var state = _lobbyStateService.GetState(code);

    return Ok(new
    {
      gameStatus = state.GameStatus,
      currentRoundNumber = state.CurrentRoundNumber,
      currentTurnPlayerOrder = state.CurrentTurnPlayerOrder,
      roundTargetWordCount = state.RoundTargetWordCount,
      selectedCategoryId = state.SelectedCategoryId,
      selectedCategoryName = state.SelectedCategoryName,
      selectedDifficulty = state.SelectedDifficulty,
      guesses = state.Guesses
        .OrderBy(guess => guess.CreatedAt)
        .Select(guess => new
        {
          guess.RoundNumber,
          guess.Word,
          guess.Correct,
          guess.SubmittedBy,
          guess.CreatedAt
        })
    });
  }

  [HttpPost("{code}/players/ready")]
  public async Task<IActionResult> UpdatePlayerReady(
    string code,
    [FromBody] UpdatePlayerReadyRequest request,
    CancellationToken cancellationToken)
  {
    try
    {
      var player = await _gameService.SetPlayerReadyAsync(code, request.Username, true, cancellationToken);
      var game = await _gameService.GetPlayersAsync(code, cancellationToken);

      if (game.Count >= 2 && game.All(existingPlayer => existingPlayer.IsReady))
      {
        await _gameService.StartGameAsync(code, cancellationToken);
        _lobbyStateService.StartGame(code, 1);
      }

      return Ok(new
      {
        player.Id,
        username = player.User?.Username ?? request.Username,
        player.IsReady
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

  [HttpPut("{code}/lobby-state/category")]
  public async Task<IActionResult> UpdateLobbyCategory(
    string code,
    [FromBody] UpdateLobbyCategoryRequest request,
    CancellationToken cancellationToken)
  {
    try
    {
      var player = await _gameService.GetPlayerByUsernameAsync(code, request.SelectedBy, cancellationToken);
      var state = _lobbyStateService.SetCategory(code, new LobbyCategorySelection
      {
        CategoryId = request.CategoryId,
        CategoryName = request.CategoryName,
        Difficulty = request.Difficulty
      }, player.PlayerOrder);

      return Ok(new
      {
        selectedCategoryId = state.SelectedCategoryId,
        selectedCategoryName = state.SelectedCategoryName,
        selectedDifficulty = state.SelectedDifficulty
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

  [HttpPost("{code}/lobby-state/guesses")]
  public async Task<IActionResult> AddLobbyGuess(
    string code,
    [FromBody] AddLobbyGuessRequest request,
    CancellationToken cancellationToken)
  {
    try
    {
      var trimmedWord = request.Word?.Trim() ?? string.Empty;
      if (string.IsNullOrWhiteSpace(trimmedWord))
      {
        return BadRequest(new { message = "Word is required." });
      }

      var players = await _gameService.GetPlayersAsync(code, cancellationToken);
      var player = players.FirstOrDefault(existingPlayer =>
        string.Equals(existingPlayer.User?.Username, request.SubmittedBy?.Trim(), StringComparison.OrdinalIgnoreCase));

      if (player is null)
      {
        return NotFound(new { message = "Player not found in this game." });
      }

      _lobbyStateService.AddGuess(code, new LobbyGuess
      {
        Word = trimmedWord,
        Correct = request.Correct,
        SubmittedBy = request.SubmittedBy?.Trim() ?? string.Empty,
        CreatedAt = DateTime.UtcNow
      }, player.PlayerOrder, players.Count);

      return Ok(new { message = "Guess saved." });
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
