# Cruz Control

Cruz Control is a project for IS216 Web Application Development II module of Singapore Management University. You provide a website link and/or a public github repo link, and it will do a passive, read-only scans and explain the findings in plain language. It would display publicly available information such as CVE findings sorted worst-first, server locations, scoring and more. AI functionality such as step by step guide and a chatbot to provide even more guidance to your issue. Check out cruz-control today!

Website Link: [cruz-control-wad2-app.vercel.app](https://cruz-control-wad2-app.vercel.app/)

## Group

Team: 11

| Team            | Members                                                         |
| --------------- | --------------------------------------------------------------- |
| Foundation Team | Cruz<br />Jeffers                               |
| Security Team   | Jun Sheng<br />Ting Kang                                        |
| AI Team         | Joyce<br />Liora                                                |

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

1. **Server software** — known bugs (CVEs) in the software the servers report
2. **Open ports** — risky services open to the internet: databases, Telnet, FTP, Remote Desktop, SSH
3. **Email & DNS** — missing SPF, DMARC and CAA records, and a weak DMARC policy (`p=none`)
4. **Certificate** — an expired, nearly expired, weak or self-signed HTTPS certificate
5. **Website security settings** — a missing HTTP→HTTPS redirect, a missing or too short HSTS
   header, and missing CSP, X-Frame-Options and X-Content-Type-Options headers

Repository checks:

1. **Secret files** — `.env` files, private keys and similar files committed to the repo
   (public certificates like `fullchain.pem` and large `.key` files such as Keynote slides are skipped)
2. **Packages** — npm dependencies with known vulnerabilities
3. **Repo basics** — SECURITY.md, Dependabot (or Renovate), a lockfile, and whether the repo is archived
4. **Ignore rules** — a `.gitignore` that's missing, or doesn't cover `.env` or key files (and
   `node_modules` when the repo has a `package.json`)
5. **README** — missing, or no setup or security information
6. **CI workflows** — GitHub Actions workflows that run text anyone can write, don't set
   `permissions:`, or use other people's actions by tag instead of by commit

## External Libraries

Frontend libraries and outside components used for the look, animation and UI (Tailwind not included).

| Library / source                                                                               | Components                                                                                                                                                                                                                                                                                                                                                                                                                                 | Where                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Motion](https://motion.dev) (`motion`)                                                       | • `motion` elements for page and card entrances, tab and modal transitions, typing and text animations<br />• `AnimatePresence` for exit animations<br />• `useInView` to start animations when scrolled into view<br />• `useSpring` + `useMotionValue` for the number ticker<br />• `useReducedMotion` so every animation respects reduced motion                                                                       | • `(landing)/`<br />• `scan/`<br />• `scan/[id]/` (Overview, Report Card, Compare)<br />• `project/`<br />• `project/[projectId]/history/`<br />• `components/`<br />• `components/robot/`                                |
| [Swiper](https://swiperjs.com) (`swiper`)                                                     | • `Swiper` + `SwiperSlide` coverflow carousels for invites and projects<br />• `EffectCoverflow`<br />• `FreeMode`<br />• `Mousewheel`<br />• `Keyboard`                                                                                                                                                                                                                                                                  | • `project/card-carousel.js`<br />• `project/page.js`                                                                                                                                                                                    |
| [ldrs](https://uiball.com/ldrs/)                                                                | • `Quantum` for the page loading overlay<br />• `Hourglass` for buttons and sections                                                                                                                                                                                                                                                                                                                                                 | • `components/loading-overlay.js`<br />• `components/small-loader.js`                                                                                                                                                                    |
| [React Icons](https://react-icons.github.io/react-icons/) (`react-icons`)                     | • Lucide icons (`lu`) across the app<br />• GitHub (`fa6`) and Google (`fc`) logos on the login buttons                                                                                                                                                                                                                                                                                                                            | • `(landing)/`<br />• `(app)/layout.js`<br />• `scan/`<br />• `scan/[id]/` and its tabs<br />• `project/`<br />• `components/`<br />• `components/auth/`<br />• `components/ask-cruz/`                                 |
| [react-globe.gl](https://github.com/vasturiano/react-globe.gl) + [three.js](https://threejs.org) | • `Globe` for the 3D exposure globe with server points and arcs<br />• `MeshPhongMaterial` from three for the globe's surface                                                                                                                                                                                                                                                                                                        | • `scan/[id]/exposure-globe.js`                                                                                                                                                                                                             |
| [d3-geo](https://d3js.org/d3-geo)                                                               | • `geoNaturalEarth1` projection for the 2D server map<br />• `geoPath` for countries<br />• `geoGraticule10` for the grid lines                                                                                                                                                                                                                                                                                                   | • `scan/[id]/server-map.js`                                                                                                                                                                                                                 |
| [Magic UI](https://magicui.design)                                                              | • Number Ticker for the counting-up numbers on the score and stats<br />• `Terminal` for the scan terminal on the landing page and while scanning<br />• `Typing Animation` for the typed terminal lines<br />• Animated Theme Toggler for the circle reveal when switching themes<br />• `Ripple Button` for the main buttons (landing, nav, scan form, results header)<br />• `Text Animate` for the landing page headline | • `scan/[id]/number-ticker.js`<br />• `components/terminal.js`<br />• `components/typing-animation.js`<br />• `components/animated-theme-toggler.js`<br />• `components/ripple-button.js`<br />• `(landing)/text-animate.js` |

## Where AI was used

| Where                                                   | How                                                                                                                                                               | AI Used                | Name      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------- |
| Peeking Robot                                           | Used AI to generate the robot svg and css to give personality to the website with Claude Code.                                                                    | Claude Code            | Cruz      |
| Project pages                                           | Skeleton code (to generate all the functions and basic page layout)                                                                                               | Claude Code            | Cruz      |
| Github Actions                                          | Auto deployment yml files was build                                                                                                                               | Claude Code            | Cruz      |
| Supabase Migration                                      | SQL to create, alter and update tables.                                                                                                                           | Claude Code            | Cruz      |
| General Page Layout                                     | Asked AI to generate a skeleton based off Ting Kang's [AI-generated prototype](https://claude.ai/artifact/DAwL5mxFKaCTParPmZuhsm)                                  | Kiro                   | Jeffers   |
| 3D Globe                                                | Consulted AI on how to generate an interactive 3D globe to map different servers                                                                                  | Kiro                   | Jeffers   |
| Store User's Fix Guide & Checklist progress in Supabase | Used AI to persistently store progress on Fix Guide/Checklist to Supabase such that navigating away does not reset them                                           | Kiro                   | Jeffers   |
| Findings Card                                           | Used AI to generate the initial baseline layout, specifically the technical details, score increment badge and expandable cards                                   | Claude Code            | Ting Kang |
| Report Card                                             | Used AI to generate the initial baseline layout as well as the animation                                                                                          | Claude Code            | Ting Kang |
| Exposure Scoring Formulas                               | Research with AI on how to weigh the scoring (based mainly on OpenSSF Scorecard's method and [internet.nl](https://internet.nl) for partial points for half-fixes) | Claude Code            | Jun Sheng |
| 2D Map                                                  | Researched with AI on how to draw the map as an inline SVG using the same files 3D globe used                                                                     | Claude Code            | Jun Sheng |
| Overview Tab                                            | Skeleton code (to generate all the functions and basic page layout)                                                                                               | Claude Code            | Jun Sheng |
| Report Card Tab                                         | Skeleton code (to generate all the functions and basic page layout)                                                                                               | Claude Code            | Jun Sheng |
| Scan History                                            | Used AI to extend the existing Express endpoint with saved website/repo targets and capture timestamps for History and Compare                                    | Codex                  | Joyce     |
| Comparison Rules                                        | Used AI to determine how 2 scans should be compared, identify repeated issues and avoid misleading results for incomplete checks                                  | Codex                  | Joyce     |
| Fix Guide                                               | Send AI the code from security team and then generate the feature's skeleton based on the security findings                                                       | Claude Code            | Liora     |
| Take The Tour                                           | Send AI the expectations of the feature based off the prototype and generate the feature's skeleton                                                               | Claude Code            | Liora     |
| Chatbot                                                 | Use AI to generate the feature's skeleton and research the best AI API for chatbot                                                                                | Claude Code, Gemini AI | Liora     |
| Checklist                                               | Send AI the list to insert in the checklist and generate the feature's skeleton                                                                                   | Claude Code            | Liora     |
