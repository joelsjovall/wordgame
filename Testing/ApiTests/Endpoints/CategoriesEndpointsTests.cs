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
            new Category { Name = "Category Easy", Difficulty = "easy", Points = 1 },
            new Category { Name = "Category Medium", Difficulty = "medium", Points = 2 },
            new Category { Name = "Category Hard", Difficulty = "hard", Points = 3 });

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
        Assert.All(payload.Categories, category =>
        {
            Assert.True(category.Id > 0);
            Assert.False(string.IsNullOrWhiteSpace(category.Name));
            Assert.False(string.IsNullOrWhiteSpace(category.Difficulty));
            Assert.Contains(category.Points, new List<int> { 1, 2, 3 });
        });
    }

    [Fact]
    public async Task GetCategories_FiltersByDifficulty_CaseInsensitive()
    {
        await ResetAndSeedCategoriesAsync(
            new Category { Name = "Category Easy", Difficulty = "easy", Points = 1 },
            new Category { Name = "Category Medium", Difficulty = "medium", Points = 2 },
            new Category { Name = "Category Hard", Difficulty = "hard", Points = 3 });

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
        Assert.Equal("Category Hard", category.Name);
        Assert.Equal("hard", category.Difficulty);
        Assert.Equal(3, category.Points);
    }

    [Fact]
    public async Task GetCategories_ReturnsEmptyList_WhenNoCategoryMatchesDifficulty()
    {
        await ResetAndSeedCategoriesAsync(
            new Category { Name = "Category Easy", Difficulty = "easy", Points = 1 },
            new Category { Name = "Category Medium", Difficulty = "medium", Points = 2 });

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.GetAsync("/api/categories?difficulty=legendary");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CategoriesResponse>();
        Assert.NotNull(payload);
        Assert.Equal(0, payload.Count);
        Assert.Empty(payload.Categories);
    }

    [Fact]
    public async Task PostCategory_CreatesCategory_WhenPayloadIsValid()
    {
        await ResetAndSeedCategoriesAsync();

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsJsonAsync("/api/categories", new
        {
            name = "Animals",
            difficulty = " EASY ",
            points = 3
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CategoryDto>();
        Assert.NotNull(payload);
        Assert.True(payload.Id > 0);
        Assert.Equal("Animals", payload.Name);
        Assert.Equal("easy", payload.Difficulty);
        Assert.Equal(3, payload.Points);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var savedCategory = await dbContext.Categories.FindAsync(payload.Id);
        Assert.NotNull(savedCategory);
        Assert.Equal("Animals", savedCategory.Name);
        Assert.Equal("easy", savedCategory.Difficulty);
        Assert.Equal(3, savedCategory.Points);
    }

    [Fact]
    public async Task PostCategory_ReturnsConflict_WhenNameAndDifficultyAlreadyExist()
    {
        await ResetAndSeedCategoriesAsync(
            new Category { Name = "Animals", Difficulty = "easy", Points = 1 });

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsJsonAsync("/api/categories", new
        {
            name = " animals ",
            difficulty = "EASY",
            points = 5
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
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

