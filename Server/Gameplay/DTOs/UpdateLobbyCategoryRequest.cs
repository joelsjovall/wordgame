namespace Server.Gameplay.DTOs;

public class UpdateLobbyCategoryRequest
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public string SelectedBy { get; set; } = string.Empty;
}
