import { expect, test, type Page, type Route } from "@playwright/test";

type ApiHandler = (route: Route, url: URL) => Promise<void> | void;

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

async function installApiMocks(page: Page, handlers: Record<string, ApiHandler>) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const key = `${route.request().method()} ${url.pathname}`;
    const handler = handlers[key];

    if (route.request().method() === "GET" && url.pathname.endsWith("/events")) {
      await route.fulfill({ status: 204 });
      return;
    }

    if (!handler) {
      throw new Error(`Unhandled API request in Playwright test: ${key}`);
    }

    await handler(route, url);
  });
}

test("home page carries entered lobby code into join flow", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Enter code").fill("4242");
  await page.getByRole("button", { name: "Join game" }).click();

  await expect(page).toHaveURL(/\/join\?code=4242$/);
  await expect(page.getByLabel("Game code")).toHaveValue("4242");
  await expect(page.getByRole("heading", { name: "Join Game" })).toBeVisible();
});

test("create game navigates to lobby and shows the created player", async ({ page }) => {
  await installApiMocks(page, {
    "POST /api/games": async (route) => {
      await fulfillJson(route, {
        gameId: 42,
        code: "4242",
        userId: 7,
        username: "Alice",
      }, 201);
    },
    "GET /api/games/42/players": async (route) => {
      await fulfillJson(route, [
        {
          id: 7,
          username: "Alice",
          score: 0,
          playerOrder: 1,
          isReady: true,
        },
      ]);
    },
    "GET /api/games/42/state": async (route) => {
      await fulfillJson(route, {
        gameId: 42,
        currentRoundId: null,
        roundNumber: null,
        phase: "round_start_pending",
        activePlayerId: 7,
        activePlayerName: "Alice",
        categoryId: null,
        categoryName: null,
        highestBidCount: null,
        highestBidPlayerId: null,
        highestBidPlayerName: null,
        deadlineUtc: null,
        secondsRemaining: null,
        readyPlayerIds: [7],
        readyPlayersCount: 1,
        totalPlayers: 1,
        allPlayersReady: false,
      });
    },
    "GET /api/games/42/current-round": async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Game 42 has no current round." }),
      });
    },
  });

  await page.goto("/create");
  await page.getByLabel("Enter username").fill("Alice");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/lobby\?code=4242&gameId=42&user=Alice&playerId=7$/);
  await expect(page.getByText("Lobby 4242")).toBeVisible();
  await expect(page.getByText("Alice")).toBeVisible();
  await expect(page.getByText("0p")).toBeVisible();
});

test("lobby hides previous round category and bid while keeping scores for next round", async ({ page }) => {
  await installApiMocks(page, {
    "GET /api/games/77/players": async (route) => {
      await fulfillJson(route, [
        {
          id: 1,
          username: "Alice",
          score: 54,
          playerOrder: 1,
          isReady: true,
        },
        {
          id: 2,
          username: "Bob",
          score: 10,
          playerOrder: 2,
          isReady: true,
        },
      ]);
    },
    "GET /api/games/77/state": async (route) => {
      await fulfillJson(route, {
        gameId: 77,
        currentRoundId: 12,
        roundNumber: 2,
        phase: "category_selection",
        activePlayerId: 1,
        activePlayerName: "Alice",
        categoryId: null,
        categoryName: null,
        highestBidCount: null,
        highestBidPlayerId: null,
        highestBidPlayerName: null,
        deadlineUtc: null,
        secondsRemaining: null,
        readyPlayerIds: [1, 2],
        readyPlayersCount: 2,
        totalPlayers: 2,
        allPlayersReady: true,
      });
    },
    "GET /api/rounds/12/results": async (route) => {
      await fulfillJson(route, {
        roundId: 12,
        gameId: 77,
        roundNumber: 2,
        status: "completed",
        currentPlayerId: 1,
        currentPlayerName: "Alice",
        deadlineUtc: null,
        secondsRemaining: null,
        highestBidCount: 5,
        highestBidPlayerId: 2,
        highestBidPlayerName: "Bob",
        category: {
          categoryId: 3,
          categoryName: "Fruits",
          pointsPerWord: 2,
        },
        players: [
          {
            userId: 1,
            username: "Alice",
            score: 54,
            turnOrder: 1,
          },
          {
            userId: 2,
            username: "Bob",
            score: 10,
            turnOrder: 2,
          },
        ],
        challenges: [],
      });
    },
    "GET /api/rounds/12/drafts": async (route) => {
      await fulfillJson(route, []);
    },
  });

  await page.goto("/lobby?code=77&gameId=77&user=Alice&playerId=1");

  await expect(page.getByText("Alice")).toBeVisible();
  await expect(page.getByText("54p")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose category" })).toBeEnabled();
  await expect(page.getByText("Choose a category to start the bidding.")).toBeVisible();
  await expect(page.getByText("Highest bid: 5 by Bob")).toHaveCount(0);
  await expect(page.getByText("Fruits")).toHaveCount(0);
});
