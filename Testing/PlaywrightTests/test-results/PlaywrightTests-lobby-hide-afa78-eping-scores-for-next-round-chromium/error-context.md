# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: PlaywrightTests.spec.ts >> lobby hides previous round category and bid while keeping scores for next round
- Location: tests\PlaywrightTests.spec.ts:100:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/lobby?code=77&gameId=77&user=Alice&playerId=1
Call log:
  - navigating to "http://localhost:5173/lobby?code=77&gameId=77&user=Alice&playerId=1", waiting until "load"

```

# Test source

```ts
  81  |       await route.fulfill({
  82  |         status: 404,
  83  |         contentType: "application/json",
  84  |         body: JSON.stringify({ message: "Game 42 has no current round." }),
  85  |       });
  86  |     },
  87  |   });
  88  | 
  89  |   await page.goto("/create");
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
> 181 |   await page.goto("/lobby?code=77&gameId=77&user=Alice&playerId=1");
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/lobby?code=77&gameId=77&user=Alice&playerId=1
  182 | 
  183 |   const aliceCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Alice" }) });
  184 |   await expect(aliceCard.getByRole("heading", { name: "Alice" })).toBeVisible();
  185 |   await expect(aliceCard.getByText("54p")).toBeVisible();
  186 |   await expect(page.getByRole("button", { name: "Choose category" })).toBeEnabled();
  187 |   await expect(page.getByText("Category_name")).toBeVisible();
  188 |   await expect(page.getByText("Highest bid: 5 by Bob")).toHaveCount(0);
  189 |   await expect(page.getByText("Fruits")).toHaveCount(0);
  190 | });
  191 | 
```