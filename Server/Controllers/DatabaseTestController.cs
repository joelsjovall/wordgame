using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.Data;

namespace Server.Controllers;

[ApiController]
[Route("api/db-test")]
public class DatabaseTestController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("ping")]
    public async Task<IActionResult> Ping()
    {
        var canConnect = await dbContext.Database.CanConnectAsync();

        return Ok(new
        {
            connected = canConnect
        });
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await dbContext.Categories
            .AsNoTracking()
            .Select(category => new
            {
                category.Id,
                category.Name
            })
            .ToListAsync();

        return Ok(new
        {
            count = categories.Count,
            categories
        });
    }
}
