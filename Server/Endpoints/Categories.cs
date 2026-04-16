using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Data.Entities;

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

        group.MapPost("/", async (AppDbContext dbContext, CreateCategoryRequest request, CancellationToken cancellationToken) =>
        {
            var name = request.Name?.Trim() ?? string.Empty;
            var difficulty = request.Difficulty?.Trim().ToLowerInvariant() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(name))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["name"] = ["Name is required."]
                });
            }

            if (string.IsNullOrWhiteSpace(difficulty))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["difficulty"] = ["Difficulty is required."]
                });
            }

            if (request.Points <= 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["points"] = ["Points must be greater than 0."]
                });
            }

            var alreadyExists = await dbContext.Categories
                .AsNoTracking()
                .AnyAsync(
                    category => category.Name.ToLower() == name.ToLower() &&
                                category.Difficulty.ToLower() == difficulty,
                    cancellationToken);

            if (alreadyExists)
            {
                return Results.Conflict(new
                {
                    message = "A category with the same name and difficulty already exists."
                });
            }

            var category = new Category
            {
                Name = name,
                Difficulty = difficulty,
                Points = request.Points
            };

            dbContext.Categories.Add(category);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/categories/{category.Id}", new
            {
                category.Id,
                category.Name,
                category.Difficulty,
                category.Points
            });
        });

        return group;
    }

    public sealed class CreateCategoryRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Difficulty { get; set; } = string.Empty;
        public int Points { get; set; }
    }
}
