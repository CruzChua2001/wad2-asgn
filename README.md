# Cruz Control

Cruz Control is a project for IS216 Web Application Development II module of Singapore Management University. You provide a website link and/or a public github repo link, and it will do a passive, read-only scans and explain the findings in plain language. It would display publicly available information such as CVE findings sorted worst-first, server locations, scoring and more. AI functionality such as step by step guide and a chatbot to provide even more guidance to your issue. Check out cruz-control today!

Website Link: [cruz-control-wad2-app.vercel.app](https://cruz-control-wad2-app.vercel.app/)

## Group

Team: 11

| Team                                        | Members                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| Foundation Team                   | Cruz<br />Jeffers                               |
| Security Team                               | Jun Sheng<br />Ting Kang                                        |
| AI Team                                     | Joyce<br />Liora                                                |

<h2><wbr>

## Repo layout

```
wad2-asgn/
├── cruz-control/          # Next.js frontend (port 3000)
├── express-server/        # Express API (port 3001)
├── supabase/              # Database migrations with supabase
└── .github/workflows/     # CICD Workflow with github actions
```

## Setup

Use Node 20.9 or newer (that's what Next.js 16 needs). Then install the dependencies in both folders:

```bash
cd cruz-control && npm install
cd ../express-server && npm install
```

### - - Database Setup

The schema lives in `supabase/migrations/`. Applying them needs the [Supabase CLI](https://supabase.com/docs/guides/local-development), run these from the repo root:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### -- Environment variables

Both the frontend and backend read their own `.env.example` file, copy it to a  `.env` under their own folder and add the values.

`cruz-control/.env`:

| Variable                                 | What it's for                                       |
| ---------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | The Supabase project the browser signs in against   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The public Supabase key for browser auth            |
| `NEXT_PUBLIC_API_URL`                  | Express backend URL:  `http://localhost:3001`  |

`express-server/.env`:

| Variable                | What it's for                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `SUPABASE_URL`        | The same Supabase project, used from the server                                           |
| `SUPABASE_SECRET_KEY` | The service_role key, the only thing that reads or writes the tables                      |
| `FRONTEND_URL`        | The frontend's address, used for CORS                                                     |
| `GITHUB_TOKEN`        | A read-only token that raises the GitHub API rate limit from 60 request per hour to 5000. |
| `GEMINI_API_KEY`      | Google Gemini API key for the Ask Cruz chat and the AI fix guides.                        |
| `GEMINI_MODEL`        | Which Gemini model those AI features use, e.g. `gemini-2.5-flash`                       |

## Running it locally

Start the API and the frontend in two terminals, after both `.env` files exist:

```bash
cd express-server && npm run dev   # nodemon on port 3001
cd cruz-control && npm run dev     # Next.js on port 3000
```

Then open `http://localhost:3000` on your browser.

## Tests and lint

Test

```Shell
cd cruz-control && npm run test			# runs the unit testing (vitest)
cd cruz-control && npm run test:e2e		# runs the e2e testing (playwright)
```

Test and Build production:

```bash
cd cruz-control && npm run build  # includes a pre-build that runs the test
```

## Branches and deploys

1. Main
   Pushing to main triggers a github action through `.github/workflows/deploy-production.yml` that deploys to production site in vercel. Open a pull request from`staging` to `main`.
2. Staging
   Pushing to staging triggers a github action through `.github/workflows/deploy-staging.yml` that deploys to staging site in vercel.
3. Feature / Fix
   Work on a branch to add new features or fix an issue (`feat/<name>` or `fix/<name>` respectively) and open a pull request into `staging`.

## What the scan checks

Website checks:

- **Server software** — known bugs (CVEs) in the software the servers report
- **Open ports** — risky services open to the internet: databases, Telnet, FTP, Remote Desktop, SSH
- **Email & DNS** — missing SPF, DMARC and CAA records, and a weak DMARC policy (`p=none`)
- **Certificate** — an expired, nearly expired, weak or self-signed HTTPS certificate
- **Website security settings** — a missing HTTP→HTTPS redirect, a missing or too short HSTS
  header, and missing CSP, X-Frame-Options and X-Content-Type-Options headers

Repository checks:

- **Secret files** — `.env` files, private keys and similar files committed to the repo
  (public certificates like `fullchain.pem` and large `.key` files such as Keynote slides are skipped)
- **Packages** — npm dependencies with known vulnerabilities
- **Repo basics** — SECURITY.md, Dependabot (or Renovate), a lockfile, and whether the repo is archived
- **Ignore rules** — a `.gitignore` that's missing, or doesn't cover `.env` or key files (and
  `node_modules` when the repo has a `package.json`)
- **README** — missing, or no setup or security information
- **CI workflows** — GitHub Actions workflows that run text anyone can write, don't set
  `permissions:`, or use other people's actions by tag instead of by commit

## External Libraries

Frontend libraries and outside components used for the look, animation and UI (Tailwind not included).

| Library / source                                                                               | How it was used                                                                                                                             | Where                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Motion](https://motion.dev) (`motion`)                                                       | Page and card entrance animations, tab and modal transitions, the robots, typing and text animations, all respecting `useReducedMotion()` | `(landing)/`, `scan/`, `scan/[id]/` (Overview, Report Card, Compare), `project/`, `project/[projectId]/history/`, `components/`, `components/robot/` |
| [Swiper](https://swiperjs.com) (`swiper`)                                                     | Coverflow carousels for invites and projects (`EffectCoverflow`, `FreeMode`, `Mousewheel`, `Keyboard`)                              | `project/page.js`                                                                                                                                                |
| [ldrs](https://uiball.com/ldrs/)                                                                | Loaders: `Quantum` for the page loading overlay, `Hourglass` for buttons and sections                                                   | `components/loading-overlay.js`, `components/small-loader.js`                                                                                                  |
| [React Icons](https://react-icons.github.io/react-icons/) (`react-icons`)                     | Lucide icons (`lu`) across the app; GitHub (`fa6`) and Google (`fc`) logos on the login buttons                                       | `(app)/layout.js`, `scan/`, `scan/[id]/` and its tabs, `project/`, `components/`, `components/auth/`, `components/ask-cruz/`                         |
| [react-globe.gl](https://github.com/vasturiano/react-globe.gl) + [three.js](https://threejs.org) | 3D exposure globe with server points and arcs; `MeshPhongMaterial` from three for the globe's surface                                     | `scan/[id]/exposure-globe.js`                                                                                                                                    |
| [d3-geo](https://d3js.org/d3-geo)                                                               | 2D server map: `geoNaturalEarth1` projection, `geoPath` for countries, `geoGraticule10` for the grid lines                            | `scan/[id]/server-map.js`                                                                                                                                        |
| [Magic UI](https://magicui.design) Number Ticker                                                | Adapted for the counting-up numbers on the score and stats                                                                                  | `scan/[id]/number-ticker.js`                                                                                                                                     |

## Where AI was used

| Where              | How                                                                                            | AI Used     | Name |
| ------------------ | ---------------------------------------------------------------------------------------------- | ----------- | ---- |
| Peeking Robot      | Used AI to generate the robot svg and css to give personality to the website with Claude Code. | Claude Code | Cruz |
| Project pages      | Skeleton code (to generate all the functions and basic page layout)                            | Claude Code | Cruz |
| Github Actions     | Auto deployment yml files was build                                                            | Claude Code | Cruz |
| Supabase Migration | SQL to create, alter and update tables.                                                        | Claude Code | Cruz |
