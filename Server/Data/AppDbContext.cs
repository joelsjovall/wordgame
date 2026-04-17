using Microsoft.EntityFrameworkCore;
using Server.Data.Entities;

namespace Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<GamePlayer> GamePlayers => Set<GamePlayer>();
    public DbSet<Round> Rounds => Set<Round>();
    public DbSet<Bid> Bids => Set<Bid>();
    public DbSet<Challenge> Challenges => Set<Challenge>();
    public DbSet<SubmittedWord> SubmittedWords => Set<SubmittedWord>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<CategoryWord> CategoryWords => Set<CategoryWord>();
    public DbSet<WordAlias> WordAliases => Set<WordAlias>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Username).HasColumnName("username").HasMaxLength(100);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<Game>(entity =>
        {
            entity.ToTable("games");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(x => x.HostUserId).HasColumnName("host_user_id");
            entity.Property(x => x.CurrentRoundId).HasColumnName("current_round_id");
            entity.Property(x => x.WinnerUserId).HasColumnName("winner_user_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");

            entity.HasOne(x => x.HostUser)
                .WithMany()
                .HasForeignKey(x => x.HostUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.WinnerUser)
                .WithMany()
                .HasForeignKey(x => x.WinnerUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<GamePlayer>(entity =>
        {
            entity.ToTable("game_players");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.GameId).HasColumnName("game_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.PlayerOrder).HasColumnName("player_order");
            entity.Property(x => x.Score).HasColumnName("score");
            entity.Property(x => x.IsReady).HasColumnName("is_ready");

            entity.HasOne(x => x.Game)
                .WithMany(x => x.Players)
                .HasForeignKey(x => x.GameId);

            entity.HasOne(x => x.User)
                .WithMany(x => x.GamePlayers)
                .HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<Round>(entity =>
        {
            entity.ToTable("rounds");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.GameId).HasColumnName("game_id");
            entity.Property(x => x.CategoryId).HasColumnName("category_id");
            entity.Property(x => x.RoundNumber).HasColumnName("round_number");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(x => x.CurrentPlayerId).HasColumnName("current_player_id");
            entity.Property(x => x.HighestBidCount).HasColumnName("highest_bid_count");
            entity.Property(x => x.HighestBidPlayerId).HasColumnName("highest_bid_player_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");

            entity.HasOne(x => x.Game)
                .WithMany(x => x.Rounds)
                .HasForeignKey(x => x.GameId);

            entity.HasOne(x => x.Category)
                .WithMany(x => x.Rounds)
                .HasForeignKey(x => x.CategoryId);

            entity.HasOne(x => x.CurrentPlayer)
                .WithMany()
                .HasForeignKey(x => x.CurrentPlayerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.HighestBidPlayer)
                .WithMany()
                .HasForeignKey(x => x.HighestBidPlayerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Bid>(entity =>
        {
            entity.ToTable("bids");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.RoundId).HasColumnName("round_id");
            entity.Property(x => x.PlayerId).HasColumnName("player_id");
            entity.Property(x => x.BidCount).HasColumnName("bid_count");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");

            entity.HasOne(x => x.Round)
                .WithMany(x => x.Bids)
                .HasForeignKey(x => x.RoundId);

            entity.HasOne(x => x.Player)
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Challenge>(entity =>
        {
            entity.ToTable("challenges");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.RoundId).HasColumnName("round_id");
            entity.Property(x => x.ChallengedPlayerId).HasColumnName("challenged_player_id");
            entity.Property(x => x.CallerPlayerId).HasColumnName("challenger_player_id");
            entity.Property(x => x.RequiredWordCount).HasColumnName("required_word_count");
            entity.Property(x => x.TimeLimitSeconds).HasColumnName("time_limit_seconds");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(x => x.CreatedAt).HasColumnName("started_at");
            entity.Property(x => x.ResolvedAt).HasColumnName("resolved_at");

            entity.HasOne(x => x.Round)
                .WithMany(x => x.Challenges)
                .HasForeignKey(x => x.RoundId);

            entity.HasOne(x => x.ChallengedPlayer)
                .WithMany()
                .HasForeignKey(x => x.ChallengedPlayerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.CallerPlayer)
                .WithMany()
                .HasForeignKey(x => x.CallerPlayerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SubmittedWord>(entity =>
        {
            entity.ToTable("submitted_words");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ChallengeId).HasColumnName("challenge_id");
            entity.Property(x => x.SubmittedByUserId).HasColumnName("submitted_by_user_id");
            entity.Property(x => x.OriginalWord).HasColumnName("original_word").HasMaxLength(100);
            entity.Property(x => x.NormalizedWord).HasColumnName("normalized_word").HasMaxLength(100);
            entity.Property(x => x.IsValid).HasColumnName("is_valid");
            entity.Property(x => x.MatchedCategoryWordId).HasColumnName("matched_category_word_id");
            entity.Property(x => x.CreatedAt).HasColumnName("submitted_at");

            entity.HasOne(x => x.Challenge)
                .WithMany(x => x.SubmittedWords)
                .HasForeignKey(x => x.ChallengeId);

            entity.HasOne(x => x.MatchedCategoryWord)
                .WithMany()
                .HasForeignKey(x => x.MatchedCategoryWordId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(150);
            entity.Property(x => x.Difficulty).HasColumnName("difficulty").HasMaxLength(50);
            entity.Property(x => x.Points).HasColumnName("points");
        });

        modelBuilder.Entity<CategoryWord>(entity =>
        {
            entity.ToTable("category_words");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CategoryId).HasColumnName("category_id");
            entity.Property(x => x.Word).HasColumnName("word").HasMaxLength(255);
            entity.Property(x => x.NormalizedWord).HasColumnName("normalized_word").HasMaxLength(255);
            entity.Property(x => x.IsActive).HasColumnName("is_active");

            entity.HasOne(x => x.Category)
                .WithMany(x => x.Words)
                .HasForeignKey(x => x.CategoryId);
        });

        modelBuilder.Entity<WordAlias>(entity =>
        {
            entity.ToTable("word_aliases");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CategoryWordId).HasColumnName("category_word_id");
            entity.Property(x => x.Alias).HasColumnName("alias").HasMaxLength(255);
            entity.Property(x => x.NormalizedAlias).HasColumnName("normalized_alias").HasMaxLength(255);

            entity.HasOne(x => x.CategoryWord)
                .WithMany(x => x.Aliases)
                .HasForeignKey(x => x.CategoryWordId);
        });
    }
}
