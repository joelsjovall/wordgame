namespace Server.Data.Entities;

public class WordAlias
{
    public int Id { get; set; }
    public int CategoryWordId { get; set; }
    public string Alias { get; set; } = string.Empty;
    public string NormalizedAlias { get; set; } = string.Empty;

    public CategoryWord? CategoryWord { get; set; }
}
