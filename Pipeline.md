# Description of our pipeline


## CI/CD Pipeline 

Our project uses a GitHub Actions–based CI/CD pipeline to ensure code quality, stability, and consistent behavior across both the frontend and backend. The pipeline runs automatically on every pull request targeting the main branch.

What the pipeline does -
The pipeline consists of several stages:

- Frontend Linting
Runs ESLint with strict React rules.
This step catches:

- React Hook dependency issues
- Invalid state updates
- Unused variables
- General code‑quality problems

If linting fails, the pipeline stops immediately.

- Frontend Build
Installs dependencies and builds the Vite/React frontend.
This ensures:

- The code compiles
- No missing imports or type errors
- The production build can be generated successfully

- Backend Build
Builds the .NET backend.
This verifies:

- All backend projects compile
- No missing references
- The API structure is valid

- Automated API Tests
Runs our API test suite to verify:

- Game creation
- Joining games
- Round flow
- Word validation
- Scoring logic

If any endpoint behaves unexpectedly, the pipeline fails.

- Postman Tests
Executes Postman collections for end‑to‑end validation.
These tests simulate real gameplay flows and ensure the system behaves correctly from a user perspective.

- Artifacts (Optional)
The pipeline can upload build artifacts such as:

- Frontend dist/ output
- Backend build output

This makes it easy to inspect builds directly from GitHub Actions.

- Why the pipeline matters
Our CI/CD pipeline ensures that:

- The main branch is always stable
- Every pull request is validated before merging
- Errors are caught early
- Code quality stays consistent
- Development is faster and safer

The pipeline has been a key part of keeping the project maintainable as it grew.