# WordGame

WordGame is a multiplayer bluffing word game built with a React frontend and an ASP.NET Core backend. Players create or join a lobby, choose a category, raise bids on how many valid words they can name, and challenge each other to prove it under time pressure.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, React Router
- Backend: ASP.NET Core 9 minimal APIs and controllers
- Database: MySQL via Entity Framework Core and Pomelo
- Testing: xUnit unit tests, xUnit API tests, Playwright end-to-end tests, Postman collection
- Containerization: Docker

## Features

- Create and join game lobbies
- Support for up to 4 players per game
- Ready-up flow before each round
- Category selection with difficulty levels
- Bidding and bluff-calling gameplay
- Timed challenge rounds with live draft sharing
- Round result tracking and score updates

## Project Structure

```text
wordgame/
|- Frontend/              React app
|- Server/                ASP.NET Core API and game logic
|- Testing/
|  |- ApiTests/           Integration/API tests
|  |- UnitTests/          Service/unit tests
|  |- PlaywrightTests/    End-to-end browser tests
|  \- TestPlan.md         High-level test plan
|- Dockerfile
\- wordgame.sln
```

## Prerequisites

- .NET 9 SDK
- Node.js 20+ and npm
- MySQL 8 compatible database

## Getting Started

### 1. Clone and install dependencies

```powershell
git clone git@github.com:joelsjovall/wordgame.git
cd wordgame
cd Frontend
npm install
cd ..
```
You can also try the game here: https://wordgame-frontend.onrender.com/

### 2. Configure the backend

The server expects a `DefaultConnection` string in configuration. For local development, add it to `Server/appsettings.Development.json` or use environment variables.

Example:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Port=3306;Database=wordgame;User Id=your-user;Password=your-password;"
  }
}
```

Important:

- Do not commit real credentials to source control.
- If the checked-in development file contains live credentials, rotate them and replace them with local-only values.

### 3. Run the app

Run frontend and backend together from the `Frontend` folder:

```powershell
cd Frontend
npm run dev:all
```

That starts:

- Frontend on `http://localhost:5173`
- Backend on `http://localhost:5068` through the Vite proxy for `/api`

You can also run them separately:

```powershell
dotnet run --project Server/Server.csproj
```

```powershell
cd Frontend
npm run dev
```

## API Notes

Main API areas:

- `/api/games` for creating games, joining lobbies, player lists, round state, and ready-up flow
- `/api/categories` for category lookup and creation
- `/api/rounds` for bidding, challenges, word validation, submissions, live drafts, and round results

Useful health endpoint:

- `GET /health`

## Testing

### Backend tests

Run all .NET tests:

```powershell
dotnet test wordgame.sln
```

Or run them separately:

```powershell
dotnet test Testing/UnitTests/WordGame.UnitTests.csproj
dotnet test Testing/ApiTests/WordGame.ApiTests.csproj
```

### Frontend checks

```powershell
cd Frontend
npm run lint
npm run build
```

### Playwright tests

From `Testing/PlaywrightTests`:

```powershell
npm install
npm test
```

These tests expect the frontend to be available at `http://localhost:5173`.

### Manual and Postman testing

- Test strategy notes live in `Testing/TestPlan.md`
- Postman assets are in `Testing/ApiTests/Postman/`

## Docker

Build and run the backend container:

```powershell
docker build -t wordgame .
docker run -p 8080:8080 wordgame
```

The container serves the backend on `http://localhost:8080`.

## Current Test Coverage Areas

Based on the current test plan, the project focuses on:

- API behavior for games, categories, rounds, submissions, and results
- Backend rules such as word validation, bidding, scoring, and game flow
- Frontend flows for create, join, lobby, and error handling
- Full game progression from lobby to round result

## Development Notes

- The frontend uses a Vite proxy to forward `/api` requests to the backend in local development.
- The frontend can also read `VITE_API_BASE_URL` if you want to point it at another backend.
- The solution file includes the server plus unit and API test projects.

