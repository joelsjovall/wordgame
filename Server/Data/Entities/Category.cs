namespace Server.Data.Entities;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public int Points { get; set; }

    public ICollection<CategoryWord> Words { get; set; } = new List<CategoryWord>();
    public ICollection<Round> Rounds { get; set; } = new List<Round>();
}
