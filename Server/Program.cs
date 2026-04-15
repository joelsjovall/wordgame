using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Data.Repositories;
using Server.Endpoints;
using Server.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddDbContext<AppDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException("Connection string 'DefaultConnection' is missing.");
    }

    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36)));
});
builder.Services.AddScoped<ICategoryWordRepository, CategoryWordRepository>();
builder.Services.AddScoped<IRoundRepository, RoundRepository>();
builder.Services.AddScoped<IWordValidationService, WordValidationService>();
builder.Services.AddScoped<IRoundService, RoundService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapControllers();
app.MapCategoriesEndpoints();

app.MapGet("/", () => Results.Ok(new
{
    message = "Det funkar boys"
}));

app.Run();

public partial class Program;
