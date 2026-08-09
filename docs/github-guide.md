# GitHub Guide

## 1. Initialize the repository

The project is already a git repo. Create a repository on GitHub (e.g. `bd-cheap-smm`), then push:

```bash
git remote add origin https://github.com/<your-username>/bd-cheap-smm.git
git push -u origin main
```

## 2. Sensitive files

`.gitignore` already excludes `.env.local`, `.env.*.local`, `.next/`, and `node_modules/`. The committed `.env.example` contains only placeholders — never commit real secrets.

Add a `.env.production` entry to `.gitignore` if you keep production values locally:

```gitignore
.env.production
.env.test
```

## 3. CI with GitHub Actions (optional)

Create `.github/workflows/ci.yml` to typecheck and lint on every push:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

Add the Supabase values as repository secrets (**Settings → Secrets and variables → Actions**) so the build can run in CI.

## 4. Automatic deploys

Connect the repository to Vercel (see [vercel-deploy.md](vercel-deploy.md)). Vercel automatically builds:

- Every push to `main` → **Production**
- Every pull request → **Preview** environment

## 5. Keep env files out of git

After cloning on a new machine:

```bash
npm install
cp .env.example .env.local
```

Then fill in real values from your Supabase project and provider account.
