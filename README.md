# Cruz Control

Cruz Control is an IS216 (WAD2) group project that helps students and beginner developers see how
exposed their own work is. You give it a website domain and/or a public GitHub repository, and it
runs a set of passive, read-only checks and then explains what it found in plain language: an
exposure score out of 100 with a grade, a list of findings sorted worst-first with practical fix
steps, and an infrastructure map showing where the site's servers are in the world.

## Project status

Features 1–6 are built and on the `staging` branch:

- Scanning a website and/or a public GitHub repository, with live progress
- Accounts and projects: save a scan to a project, re-scan it, and invite members as owners or
  viewers
- An exposure score out of 100 with a grade and a breakdown by category
- Prioritised findings, worst first, with plain-language explanations and short fix steps
- An infrastructure map of the site's servers, as a 3D globe or a 2D map
- A Report Card tab with the grade, points lost per category, the top three fixes and, for
  project scans, the score over time

Features 7–9 are next, built by the AI team from 20 Oct: a fix guide and checklist, scan history
and compare, and the "Ask Cruz" chatbot. Until then, the Fix Guide, Checklist and Compare tabs on
the results page are placeholders that say "coming soon", the Ask Cruz button does nothing yet,
and the Learn link leads to a page that doesn't exist yet.

## Repo layout

```
wad2-asgn/
├── cruz-control/          # Next.js frontend (port 3000)
├── express-server/        # Express API (port 3001)
├── supabase/              # Database migrations
└── .github/workflows/     # Deploy workflows
```

The frontend and the backend each have their own `package.json`, so npm commands are always run
inside one of those two folders.

## Where things are

- **Results pages**: `cruz-control/src/app/(app)/scan/[id]/`, one folder per tab. The Overview
  is `page.js`, and the others are `report-card/`, `fix-guide/`, `checklist/` and `compare/`.
- **Projects page**: `cruz-control/src/app/(app)/project/`
- **API**: `express-server/`. A request goes through `routes/` (the endpoints), then
  `middleware/` (who the user is, their role in the project, and the scan rate limit), then
  `controllers/` (the work itself, including reading and writing the database). The browser never
  reads the database directly.
- **Findings**: `express-server/lib/findings.js` turns saved scan results into findings with
  plain-language explanations and fixes.
- **Score**: `express-server/lib/score.js` scores each check and works out the grade and the
  breakdown.
- **Checks**: `express-server/checks/domain/` (website) and `express-server/checks/github/`
  (repository), one file per check.

Findings and the score aren't stored. The API works them out from the saved results each time a
scan is opened, so a change to the rules applies to old scans too.

The AI features (fix guide, checklist, compare and Ask Cruz) are built on the findings and the
score, so don't rename or drop their fields. A finding has `id`, `category`, `checkId`, `kind`,
`severity`, `source`, `title`, `explain`, `fix`, `details`, and sometimes `hosts` and
`learnMore`. A scan's score comes with `score`, `grade`, `uncappedScore`, `cap`, `incomplete`,
`breakdown` and `checks`. Finding IDs such as `port-3306` or `dns-dmarc` stay the same from one
scan to the next, so later scans can be matched to earlier ones: don't change them. If a feature
needs more, add a new field next to the old ones.

A fuller local guide for contributors and their coding assistants (`AGENTS.md`) is shared within
the team rather than committed.

## Setup

Neither `package.json` sets an `engines` field, so use Node 20.9 or newer (that's what Next.js
16 needs). Then install the dependencies in both folders:

```bash
cd cruz-control && npm install
cd ../express-server && npm install
```

## Environment variables

Both apps read their own `.env` file. Each folder has a `.env.example` with the same keys and no
values, so copy that and fill it in. `.env` files are gitignored and stay on your machine.

`cruz-control/.env`:

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project the browser signs in against |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The public Supabase key for browser auth |
| `NEXT_PUBLIC_API_URL` | Where the Express API is, `http://localhost:3001` locally |

`express-server/.env`:

| Variable | What it's for |
|---|---|
| `SUPABASE_URL` | The same Supabase project, used from the server |
| `SUPABASE_SECRET_KEY` | The service_role key, the only thing that reads or writes the tables |
| `FRONTEND_URL` | The frontend's address, used for CORS and invite email links |
| `GITHUB_TOKEN` | Optional. A read-only token that raises the GitHub API rate limit |

`SUPABASE_SECRET_KEY` is the service_role key and can do anything to the database. It belongs
only in `express-server/.env`. Never put it in the frontend, and never put it in a
`NEXT_PUBLIC_*` variable, because anything named `NEXT_PUBLIC_*` is sent to the browser.

## Database

The schema lives in `supabase/migrations/` (three files so far: projects, the service_role grant,
and the scan tables). Applying them needs the [Supabase CLI](https://supabase.com/docs/guides/local-development):

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Run those from the repo root. To change the schema, create a new migration with
`supabase migration new <name>` and push again — don't edit a migration that has already been
pushed.

## Running it locally

Start the API and the frontend in two terminals, after both `.env` files exist:

```bash
cd express-server && npm run dev   # nodemon on port 3001
cd cruz-control && npm run dev     # Next.js on port 3000
```

Then open `http://localhost:3000`. The frontend calls the API, so the API needs to be running
too.

## Tests and lint

```bash
cd express-server && npm test      # Node's built-in test runner
cd cruz-control && npm run lint    # ESLint; CI fails on lint errors
cd cruz-control && npm run build   # check the production build still works
```

CI runs the frontend lint but not the backend tests, so run `npm test` yourself before pushing
backend changes.

## Branches and deploys

Work on a branch (`feat/<name>` or `fix/<name>`) and open a pull request into `staging`. Pushing
to `staging` deploys the staging site through `.github/workflows/deploy-staging.yml`. `staging`
goes into `main` by pull request, the first time at the 20 Oct handover, and pushing to `main`
deploys production through `deploy-production.yml`. Deploys only ever happen in CI, never from a
laptop.

## What the scan checks

Website checks:

- **Server software** — known bugs (CVEs) in the software the servers report
- **Open ports** — risky services open to the internet: databases, Telnet, FTP, Remote Desktop, SSH
- **Email & DNS** — SPF, DMARC and CAA records
- **Certificate** — an expired, nearly expired, weak or self-signed HTTPS certificate
- **Website security settings** — a missing HTTP→HTTPS redirect and missing security headers

Repository checks:

- **Secret files** — `.env` files, private keys and similar files committed to the repo
- **Packages** — npm dependencies with known vulnerabilities
- **Repo basics** — SECURITY.md, Dependabot (or Renovate) and a lockfile
- **Ignore rules** — a `.gitignore` that's missing, or doesn't cover `.env`, `node_modules` or key files
- **README** — missing, or no setup or security information
- **CI workflows** — GitHub Actions workflows that run text anyone can write, don't set
  `permissions:`, or use other people's actions by tag instead of by commit

Every check is passive: free public APIs and ordinary requests only. Cruz Control never attacks
anything, logs in anywhere, or changes anything in the repos and sites it looks at.

The score works like this: your score is out of 100, and higher is safer. Each check scores 0 to
10, and riskier checks count for more. A critical problem keeps your score at 50 or below until
it's fixed.

## Known limits

- DNSSEC isn't checked.
- Secret files are matched by their names, not by reading what's inside files.
- Only the npm packages in the repository's root `package.json` are checked, so packages in
  subfolders and in other languages are missed.
- Packages are only flagged when they have a known vulnerability, not just for being out of date.
  Every vulnerable package is rated high, and its fix says to update to the latest version,
  because the exact fixed version isn't looked up yet.
- CVEs come from the version a server reports, not from testing it, so they're informed guesses
  rather than confirmed bugs.
- Servers that belong to a CDN (shared networks like Cloudflare) are left out of the port and
  CVE checks, since they aren't the site owner's to fix.
- Older scans show checks that were added after them as "Not checked". A new scan runs them all.
- The 2D map doesn't shade Singapore, Hong Kong and Bahrain, though their server dots still show.

## Reporting a security problem

If you find a security problem in Cruz Control, please tell the team (IS216 G4 Group 11) privately
instead of opening a public issue, so it can be fixed first. Don't include secrets, tokens or scan
output with real keys in your report.

Please also only scan domains and repositories you own or have permission to scan.
