using Microsoft.EntityFrameworkCore;
using Server.Data;

namespace Server.Endpoints;

public static class CategoriesEndpoints
{
    public static RouteGroupBuilder MapCategoriesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/categories");

        group.MapGet("/", async (AppDbContext dbContext, string? difficulty, CancellationToken cancellationToken) =>
        {
            var query = dbContext.Categories.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(difficulty))
            {
                var normalizedDifficulty = difficulty.Trim().ToLower();
                query = query.Where(category => category.Difficulty.ToLower() == normalizedDifficulty);
            }

            var categories = await query
                .OrderBy(category => category.Name)
                .Select(category => new
                {
                    category.Id,
                    category.Name,
                    category.Difficulty,
                    category.Points
                })
                .ToListAsync(cancellationToken);

            return Results.Ok(new
            {
                count = categories.Count,
                categories
            });
        });

        return group;
    }
}
