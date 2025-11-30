# Contributing to BFSI Insights

## Maintainer

**Rick te Molder** — [@Rick-te-Molder](https://github.com/Rick-te-Molder)

---

## Workflow

We use **Linear** for issue tracking and **GitHub** for code management.

### 1. Pick an Issue

- All work starts with a Linear issue
- Issues are organized in projects and cycles
- Grab an issue from the current cycle or create one if needed

### 2. Create a Branch

```bash
git checkout main
git pull origin main
git checkout -b kb-123-short-description
```

**Branch naming convention:** `kb-{issue-id}-{short-description}`

Examples:

- `kb-42-add-filter-component`
- `kb-108-fix-date-parsing`

### 3. Make Changes

- Follow the code style (auto-enforced by pre-commit hooks)
- Run tests locally: `npm run test`
- Keep commits focused and atomic

### 4. Commit with Linear Reference

Include the Linear issue ID in your commit message:

```bash
# Links to issue (doesn't close it)
git commit -m "feat: add industry filter dropdown

KB-123"

# Closes the issue when PR is merged
git commit -m "fix: resolve date parsing edge case

Fixes KB-123"
```

**Magic words** that auto-close Linear issues:

- `fixes KB-123`
- `closes KB-123`
- `resolves KB-123`

### 5. Push and Create PR

```bash
git push -u origin kb-123-short-description
```

Then create a Pull Request on GitHub:

- Target branch: `main`
- Title: Brief description (Linear auto-links via branch name)
- Description: What changed and why

### 6. CI Checks & Merge

- Wait for CI checks to pass (lint, tests, build)
- Review the diff
- Merge using **Squash and merge** (keeps history clean)
- Delete the branch after merging

---

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

[optional body]

[Linear reference]
```

**Types:**

- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code change that neither fixes a bug nor adds a feature
- `docs` — Documentation only
- `test` — Adding or updating tests
- `chore` — Maintenance (deps, config, etc.)

---

## Code Style

- **Linting:** ESLint + Prettier (auto-enforced via pre-commit hook)
- **Formatting:** Runs automatically on commit via lint-staged
- **Tests:** Add tests for new functionality; don't reduce coverage

---

## Development Setup

```bash
# Clone and install
git clone https://github.com/Rick-te-Molder/bfsi-insights.git
cd bfsi-insights
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Run linting
npm run lint
```

---

## Questions?

Open a Linear issue or reach out to the maintainer.
