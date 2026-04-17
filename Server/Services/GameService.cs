using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Data.Entities;

namespace Server.Services;

public class GameService
{
  private readonly AppDbContext _db;
  private readonly IWordValidationService _validator;
  private const int MaxPlayersPerGame = 4;

  public GameService(AppDbContext db, IWordValidationService validator)
  {
    _db = db;
    _validator = validator;
  }

  public async Task<Game> CreateGameAsync(string username, CancellationToken cancellationToken = default)
  {
    var normalizedUsername = NormalizeRequiredValue(username, nameof(username));
    var user = await GetOrCreateUserAsync(normalizedUsername, cancellationToken);

    var game = new Game
    {
      Status = "lobby",
      HostUserId = user.Id,
      CreatedAt = DateTime.UtcNow
    };

    _db.Games.Add(game);
    await _db.SaveChangesAsync(cancellationToken);

    var hostPlayer = new GamePlayer
    {
      GameId = game.Id,
      UserId = user.Id,
      PlayerOrder = 1,
      Score = 0,
      IsReady = false
    };

    _db.GamePlayers.Add(hostPlayer);
    await _db.SaveChangesAsync(cancellationToken);

    return await GetGameWithPlayersAsync(game.Id, cancellationToken)
        ?? throw new InvalidOperationException("Created game could not be loaded.");
  }

  public async Task<Game> JoinGameAsync(string username, string code, CancellationToken cancellationToken = default)
  {
    var normalizedUsername = NormalizeRequiredValue(username, nameof(username));
    var gameId = ParseGameCode(code);

    var game = await GetGameWithPlayersAsync(gameId, cancellationToken);
    if (game is null)
    {
      throw new KeyNotFoundException("Game not found.");
    }

    if (!string.Equals(game.Status, "lobby", StringComparison.OrdinalIgnoreCase))
    {
      throw new InvalidOperationException("This game has already started.");
    }

    if (game.Players.Count >= MaxPlayersPerGame)
    {
      throw new InvalidOperationException("This lobby is full.");
    }

    if (game.Players.Any(player => string.Equals(player.User?.Username, normalizedUsername, StringComparison.OrdinalIgnoreCase)))
    {
      throw new InvalidOperationException("That username is already taken in this lobby.");
    }

    var user = await GetOrCreateUserAsync(normalizedUsername, cancellationToken);

    var gamePlayer = new GamePlayer
    {
      GameId = game.Id,
      UserId = user.Id,
      PlayerOrder = game.Players.Count + 1,
      Score = 0,
      IsReady = false
    };

    _db.GamePlayers.Add(gamePlayer);
    await _db.SaveChangesAsync(cancellationToken);

    return await GetGameWithPlayersAsync(gameId, cancellationToken)
        ?? throw new InvalidOperationException("Joined game could not be loaded.");
  }

  public async Task<IReadOnlyList<GamePlayer>> GetPlayersAsync(string code, CancellationToken cancellationToken = default)
  {
    var gameId = ParseGameCode(code);

    var game = await GetGameWithPlayersAsync(gameId, cancellationToken);
    if (game is null)
    {
      throw new KeyNotFoundException("Game not found.");
    }

    return game.Players
        .OrderBy(player => player.PlayerOrder)
        .ToList();
  }

  public async Task<GamePlayer> SetPlayerReadyAsync(
      string code,
      string username,
      bool isReady,
      CancellationToken cancellationToken = default)
  {
    var player = await GetPlayerByUsernameAsync(code, username, cancellationToken);

    player.IsReady = isReady;
    await _db.SaveChangesAsync(cancellationToken);

    return player;
  }

  public async Task<Game> StartGameAsync(string code, CancellationToken cancellationToken = default)
  {
    var gameId = ParseGameCode(code);
    var game = await GetGameWithPlayersAsync(gameId, cancellationToken);
    if (game is null)
    {
      throw new KeyNotFoundException("Game not found.");
    }

    if (game.Players.Count < 2)
    {
      throw new InvalidOperationException("At least two players are required to start the game.");
    }

    if (game.Players.Any(player => !player.IsReady))
    {
      throw new InvalidOperationException("All players must press start game before the game can begin.");
    }

    game.Status = "in-progress";
    await _db.SaveChangesAsync(cancellationToken);

    return game;
  }

  public async Task<GamePlayer> GetPlayerByUsernameAsync(
      string code,
      string username,
      CancellationToken cancellationToken = default)
  {
    var normalizedUsername = NormalizeRequiredValue(username, nameof(username));
    var players = await GetPlayersAsync(code, cancellationToken);

    var player = players.FirstOrDefault(existingPlayer =>
      string.Equals(existingPlayer.User?.Username, normalizedUsername, StringComparison.OrdinalIgnoreCase));

    return player ?? throw new KeyNotFoundException("Player not found in this game.");
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

  private async Task<Game?> GetGameWithPlayersAsync(int gameId, CancellationToken cancellationToken)
  {
    return await _db.Games
        .Include(game => game.Players)
            .ThenInclude(gamePlayer => gamePlayer.User)
        .Include(game => game.HostUser)
        .FirstOrDefaultAsync(game => game.Id == gameId, cancellationToken);
  }

  private async Task<User> GetOrCreateUserAsync(string normalizedUsername, CancellationToken cancellationToken)
  {
    var existingUser = await _db.Users
        .FirstOrDefaultAsync(user => user.Username == normalizedUsername, cancellationToken);

    if (existingUser is not null)
    {
      return existingUser;
    }

    var user = new User
    {
      Username = normalizedUsername,
      CreatedAt = DateTime.UtcNow
    };

    _db.Users.Add(user);
    await _db.SaveChangesAsync(cancellationToken);

    return user;
  }

  private static string NormalizeRequiredValue(string value, string paramName)
  {
    var normalizedValue = value?.Trim();
    if (string.IsNullOrWhiteSpace(normalizedValue))
    {
      throw new ArgumentException("Value is required.", paramName);
    }

    return normalizedValue;
  }

  private static int ParseGameCode(string code)
  {
    var normalizedCode = NormalizeRequiredValue(code, nameof(code));
    if (!int.TryParse(normalizedCode, out var gameId) || gameId <= 0)
    {
      throw new ArgumentException("Game code must be a valid positive number.", nameof(code));
    }

    return gameId;
  }
}
