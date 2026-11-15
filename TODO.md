# TODO: Job Scout (job scraper)

> Design details live in [UPDATE_SCANDIVA.md](UPDATE_SCANDIVA.md) §2.1, §5–§8, §10–§12. This file only lists the work.
> Email (SMTP, sending applications, interview reminders) is out of scope here; only the job digest depends on it.

## MVP: Greenhouse / Lever / RSS ✅

### Scheduler (in-process, replaces the separate worker)
- [x] `backend/src/scrapers/scheduler.js`: one-minute `setInterval`, runs active searches where `lastRunAt + frequencyMin <= now`, with no overlapping ticks
- [x] Started from `src/index.js` unless `ENABLE_SCHEDULER=false`; never runs in tests (they import `app.js` only)
- [x] Env vars: `ENABLE_SCHEDULER`, `SCRAPER_MIN_INTERVAL_MIN` (default 60), `SCRAPER_USER_AGENT`
- [x] Only new dependency: `rss-parser`

### Data model
- [x] `JobSearch` and `JobPosting` in `schema.prisma`, `@@unique([userId, source, externalId])`, `onDelete: Cascade` on `User`
- [x] `Application.jobPosting` back-relation
- [x] `validateJobSearch` + `JOB_POSTING_STATUSES` in `validators.js` (slug charset for board/company, http(s) only for RSS)

### Source adapters
- [x] `scrapers/http.js`: shared `fetchText` / `fetchJson` (15 s timeout, User-Agent, 5 MB cap), `normalizeContract`
- [x] `greenhouse.js`, `lever.js`, `rss.js` (sha1 of the link when an item has no guid)
- [x] `scrapers/index.js` `runSearch`: every query term must be in the title; location is a substring match and postings with no location are kept; dedup via the unique key (P2002); per-source errors go to `lastError`

### API (`routes/jobs.routes.js`)
- [x] `GET/POST /job-searches`, `PUT/DELETE /job-searches/:id`
- [x] `POST /job-searches/:id/run` with a 5-minute cooldown derived from `lastRunAt`
- [x] `GET /job-postings?status=&searchId=`, `PATCH /job-postings/:id` (new / saved / dismissed)
- [x] `POST /job-postings/:id/convert` → To Apply `Application` in a transaction; 409 on a second convert

### Frontend
- [x] `JobInboxView.tsx`: search list + editor, Run now / pause / edit / delete, `lastError`; posting tabs (New / Saved / Dismissed / On board) with Save / Dismiss / Restore / Add to board / Open
- [x] "Jobs" view in `App.tsx`; converted applications show up on the board immediately

### Tests and docs
- [x] `backend/tests/jobs.test.js` (22 tests, fixtures in `tests/fixtures/`, `fetch` stubbed)
- [x] README feature list, DEPLOY.md, `.env.production.example`, UPDATE_SCANDIVA.md decision note

## Next steps (in priority order)

1. **Manual check against real boards**: the adapters were only tested against fixtures.
   - [ ] `make up`, then create a search in Jobs: Greenhouse `gitlab`, Lever `netflix`, query `engineer`
   - [ ] Press Run now and check postings appear with no `lastError`
   - [ ] Add one to the board and confirm it shows under To Apply
2. **Open a PR to `main`**
   - [ ] Optionally rename the branch from `docs/job-scout-email-plan` to `feat/job-scout`
   - [ ] Make sure CI (backend tests + frontend build) passes
3. **SSRF guard for RSS URLs**: required before opening registration; Phase 3 reuses it
   - [ ] `scrapers/safeFetch.js`: resolve DNS first, block private / loopback / link-local / `169.254.169.254`, re-check every redirect hop
   - [ ] Route `rss.js` through it, with tests for each blocked case
4. **Small improvements** (not urgent)
   - [ ] New-posting count badge on the Jobs nav button
   - [ ] Prune old dismissed postings so the table doesn't grow forever
   - [ ] Consider moving from `prisma db push` to `prisma migrate` (NOTE.md §10 #6)
5. **Email Phase 1** (UPDATE_SCANDIVA.md §2.2, §11): unblocks the job digest below
   - [ ] SMTP settings with the password encrypted via `ENCRYPTION_KEY`, plus `/email/test`
   - [ ] Interview reminders driven by the existing scheduler, idempotent via `EmailLog`

## Phase 3: HTML + AI adapter

- [ ] Extract the parse-job core from `ai.routes.js` into `lib/parseJob.js` and have the route use it
- [ ] Extend `scrapers/safeFetch.js` (from next step 3) for HTML pages:
  - [ ] 2 MB response cap
  - [ ] Respect robots.txt and rate-limit per domain
- [ ] `html.js` (adds `cheerio`): safeFetch → strip script/nav, extract text → `parseJob` (skip and record `lastError` when the user has no AI configured)
- [ ] Add an "Any URL" source option to the search editor

## Job digest (depends on the SMTP settings from Email Phase 1)

- [ ] Add `JobPosting.digestedAt`
- [ ] The scheduler sends new postings with an empty `digestedAt` at `digestHour` in the user's timezone
- [ ] Only for users with `notifyDigest = true`; write `EmailLog` before sending so nothing is sent twice
- [ ] Set `digestedAt` after sending
