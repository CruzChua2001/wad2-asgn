# Security Policy

Cruz Control is a school project (IS216, G4 Group 11), but we still want to hear about security problems.

## Supported versions

Only the latest code on the `main` branch (the live site) gets security fixes.

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

Instead, report it privately:

1. Go to the **Security** tab of this repo.
2. Click **Report a vulnerability**.
3. Fill in the form.

Please include:

- What the problem is and where (page, API route or file)
- Steps to reproduce it
- What an attacker could do with it

We'll reply within 7 days and let you know when it's fixed.

## Scope

- In scope: the Cruz Control website and API, and the code in this repo.
- Out of scope: the third-party services we use (Supabase, Vercel, GitHub, Shodan, OSV.dev, ip-api.com). Please report those to them directly.

Please don't run active attacks against the live site (load tests, brute force, scanning other people's data). Cruz Control itself only does passive, read-only checks, and we ask the same of you.
