Testplan

Test area:       What is tested:                                                           How it is tested:                          Expected result:

API tests    Categories, games, players, rounds, challanges, submissions, results, drafts  Automated API tests + Postman              API returns correct status, data, and state
Backend logic    Word validation, bidding rules, scoring, game flow                        Unit tests + API tests                     Rules work correctly and invalid actions are rejected
Frontend logic   Create, join, lobby, game state, errors                                   Manual testing + planned Playwright tests  UI updates correctly and shows errors clearl
Game flow        Create game, join, ready up, start round, bid, challange, submit words    Manual gameplay test                       Game can be played from start to result
Validation       Invalid codes, duplicate usersnames, wrong turns, invalid bids/words      API tests + manual testning                Bad input is rejected without breaking game state
Pipeline         Build, lint, unit/API tests                                               GitHub Actions/locally                     Everything passes before merge


