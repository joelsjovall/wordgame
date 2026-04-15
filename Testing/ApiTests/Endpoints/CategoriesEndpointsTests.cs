using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Server.Data;
using Server.Data.Entities;
using WordGame.ApiTests.Fixtures;
using Xunit;

namespace WordGame.ApiTests.Endpoints;

public class CategoriesEndpointsTests(CustomWebApplicationFactory factory) : IClassFixture<CustomWebApplicationFactory>
{
    [Fact]
    public async Task GetCategories_ReturnsAllCategories_WhenNoDifficultyFilterIsProvided()
    {
        await ResetAndSeedCategoriesAsync(
            new Category { Id = 1, Name = "Djur", Difficulty = "easy", Points = 100 },
            new Category { Id = 2, Name = "Bilar", Difficulty = "medium", Points = 200 },
            new Category { Id = 3, Name = "Länder", Difficulty = "hard", Points = 300 });

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.GetAsync("/api/categories");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CategoriesResponse>();
        Assert.NotNull(payload);
        Assert.Equal(3, payload.Count);
        Assert.Equal(3, payload.Categories.Count);
    }

    [Fact]
    public async Task GetCategories_FiltersByDifficulty_CaseInsensitive()
    {
        await ResetAndSeedCategoriesAsync(
            new Category { Id = 1, Name = "Djur", Difficulty = "easy", Points = 100 },
            new Category { Id = 2, Name = "Bilar", Difficulty = "medium", Points = 200 },
            new Category { Id = 3, Name = "Länder", Difficulty = "hard", Points = 300 });

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.GetAsync("/api/categories?difficulty=HaRd");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CategoriesResponse>();
        Assert.NotNull(payload);
        Assert.Equal(1, payload.Count);
        var category = Assert.Single(payload.Categories);
        Assert.Equal("Länder", category.Name);
        Assert.Equal("hard", category.Difficulty);
        Assert.Equal(300, category.Points);
    }

    private async Task ResetAndSeedCategoriesAsync(params Category[] categories)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();

        dbContext.Categories.AddRange(categories);
        await dbContext.SaveChangesAsync();
    }

    public sealed class CategoriesResponse
    {
        public int Count { get; set; }
        public List<CategoryDto> Categories { get; set; } = [];
    }

    public sealed class CategoryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Difficulty { get; set; } = string.Empty;
        public int Points { get; set; }
    }
}
