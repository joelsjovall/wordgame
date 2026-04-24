# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: PlaywrightTests.spec.ts >> create game navigates to lobby and shows the created player
- Location: tests\PlaywrightTests.spec.ts:38:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/create
Call log:
  - navigating to "http://localhost:5173/create", waiting until "load"

```

# Test source

```ts
  1   | import { expect, test, type Page, type Route } from "@playwright/test";
  2   | 
  3   | type ApiHandler = (route: Route, url: URL) => Promise<void> | void;
  4   | 
  5   | async function fulfillJson(route: Route, payload: unknown, status = 200) {
  6   |   await route.fulfill({
  7   |     status,
  8   |     contentType: "application/json",
  9   |     body: JSON.stringify(payload),
  10  |   });
  11  | }
  12  | 
  13  | async function installApiMocks(page: Page, handlers: Record<string, ApiHandler>) {
  14  |   await page.route("**/api/**", async (route) => {
  15  |     const url = new URL(route.request().url());
  16  |     const key = `${route.request().method()} ${url.pathname}`;
  17  |     const handler = handlers[key];
  18  | 
  19  |     if (!handler) {
  20  |       throw new Error(`Unhandled API request in Playwright test: ${key}`);
  21  |     }
  22  | 
  23  |     await handler(route, url);
  24  |   });
  25  | }
  26  | 
  27  | test("home page carries entered lobby code into join flow", async ({ page }) => {
  28  |   await page.goto("/");
  29  | 
  30  |   await page.getByLabel("Enter code").fill("4242");
  31  |   await page.getByRole("button", { name: "Join game" }).click();
  32  | 
  33  |   await expect(page).toHaveURL(/\/join\?code=4242$/);
  34  |   await expect(page.getByLabel("Game code")).toHaveValue("4242");
  35  |   await expect(page.getByRole("heading", { name: "Join Game" })).toBeVisible();
  36  | });
  37  | 
  38  | test("create game navigates to lobby and shows the created player", async ({ page }) => {
  39  |   await installApiMocks(page, {
  40  |     "POST /api/games": async (route) => {
  41  |       await fulfillJson(route, {
  42  |         gameId: 42,
  43  |         code: "4242",
  44  |         userId: 7,
  45  |         username: "Alice",
  46  |       }, 201);
  47  |     },
  48  |     "GET /api/games/42/players": async (route) => {
  49  |       await fulfillJson(route, [
  50  |         {
  51  |           id: 7,
  52  |           username: "Alice",
  53  |           score: 0,
  54  |           playerOrder: 1,
  55  |           isReady: true,
  56  |         },
  57  |       ]);
  58  |     },
  59  |     "GET /api/games/42/state": async (route) => {
  60  |       await fulfillJson(route, {
  61  |         gameId: 42,
  62  |         currentRoundId: null,
  63  |         roundNumber: null,
  64  |         phase: "round_start_pending",
  65  |         activePlayerId: 7,
  66  |         activePlayerName: "Alice",
  67  |         categoryId: null,
  68  |         categoryName: null,
  69  |         highestBidCount: null,
  70  |         highestBidPlayerId: null,
  71  |         highestBidPlayerName: null,
  72  |         deadlineUtc: null,
  73  |         secondsRemaining: null,
  74  |         readyPlayerIds: [7],
  75  |         readyPlayersCount: 1,
  76  |         totalPlayers: 1,
  77  |         allPlayersReady: false,
  78  |       });
  79  |     },
  80  |     "GET /api/games/42/current-round": async (route) => {
  81  |       await route.fulfill({
  82  |         status: 404,
  83  |         contentType: "application/json",
  84  |         body: JSON.stringify({ message: "Game 42 has no current round." }),
  85  |       });
  86  |     },
  87  |   });
  88  | 
> 89  |   await page.goto("/create");
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/create
  90  |   await page.getByLabel("Enter username").fill("Alice");
  91  |   await page.getByRole("button", { name: "Continue" }).click();
  92  | 
  93  |   await expect(page).toHaveURL(/\/lobby\?code=4242&gameId=42&user=Alice&playerId=7$/);
  94  |   await expect(page.getByText("Your lobbycode: 4242")).toBeVisible();
  95  |   const aliceCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Alice" }) });
  96  |   await expect(aliceCard.getByRole("heading", { name: "Alice" })).toBeVisible();
  97  |   await expect(aliceCard.getByText("0p")).toBeVisible();
  98  | });
  99  | 
  100 | test("lobby hides previous round category and bid while keeping scores for next round", async ({ page }) => {
  101 |   await installApiMocks(page, {
  102 |     "GET /api/games/77/players": async (route) => {
  103 |       await fulfillJson(route, [
  104 |         {
  105 |           id: 1,
  106 |           username: "Alice",
  107 |           score: 54,
  108 |           playerOrder: 1,
  109 |           isReady: true,
  110 |         },
  111 |         {
  112 |           id: 2,
  113 |           username: "Bob",
  114 |           score: 10,
  115 |           playerOrder: 2,
  116 |           isReady: true,
  117 |         },
  118 |       ]);
  119 |     },
  120 |     "GET /api/games/77/state": async (route) => {
  121 |       await fulfillJson(route, {
  122 |         gameId: 77,
  123 |         currentRoundId: 12,
  124 |         roundNumber: 2,
  125 |         phase: "category_selection",
  126 |         activePlayerId: 1,
  127 |         activePlayerName: "Alice",
  128 |         categoryId: null,
  129 |         categoryName: null,
  130 |         highestBidCount: null,
  131 |         highestBidPlayerId: null,
  132 |         highestBidPlayerName: null,
  133 |         deadlineUtc: null,
  134 |         secondsRemaining: null,
  135 |         readyPlayerIds: [1, 2],
  136 |         readyPlayersCount: 2,
  137 |         totalPlayers: 2,
  138 |         allPlayersReady: true,
  139 |       });
  140 |     },
  141 |     "GET /api/rounds/12/results": async (route) => {
  142 |       await fulfillJson(route, {
  143 |         roundId: 12,
  144 |         gameId: 77,
  145 |         roundNumber: 2,
  146 |         status: "completed",
  147 |         currentPlayerId: 1,
  148 |         currentPlayerName: "Alice",
  149 |         deadlineUtc: null,
  150 |         secondsRemaining: null,
  151 |         highestBidCount: 5,
  152 |         highestBidPlayerId: 2,
  153 |         highestBidPlayerName: "Bob",
  154 |         category: {
  155 |           categoryId: 3,
  156 |           categoryName: "Fruits",
  157 |           pointsPerWord: 2,
  158 |         },
  159 |         players: [
  160 |           {
  161 |             userId: 1,
  162 |             username: "Alice",
  163 |             score: 54,
  164 |             turnOrder: 1,
  165 |           },
  166 |           {
  167 |             userId: 2,
  168 |             username: "Bob",
  169 |             score: 10,
  170 |             turnOrder: 2,
  171 |           },
  172 |         ],
  173 |         challenges: [],
  174 |       });
  175 |     },
  176 |     "GET /api/rounds/12/drafts": async (route) => {
  177 |       await fulfillJson(route, []);
  178 |     },
  179 |   });
  180 | 
  181 |   await page.goto("/lobby?code=77&gameId=77&user=Alice&playerId=1");
  182 | 
  183 |   const aliceCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Alice" }) });
  184 |   await expect(aliceCard.getByRole("heading", { name: "Alice" })).toBeVisible();
  185 |   await expect(aliceCard.getByText("54p")).toBeVisible();
  186 |   await expect(page.getByRole("button", { name: "Choose category" })).toBeEnabled();
  187 |   await expect(page.getByText("Category_name")).toBeVisible();
  188 |   await expect(page.getByText("Highest bid: 5 by Bob")).toHaveCount(0);
  189 |   await expect(page.getByText("Fruits")).toHaveCount(0);
```