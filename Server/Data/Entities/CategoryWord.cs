namespace Server.Data.Entities;

public class CategoryWord
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string Word { get; set; } = string.Empty;
    public string NormalizedWord { get; set; } = string.Empty;

    public Category? Category { get; set; }
    public ICollection<WordAlias> Aliases { get; set; } = new List<WordAlias>();
}
