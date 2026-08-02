# Candivana

**A self-hosted workspace for managing your job search.**

Track applications, interviews, CVs, and motivation letters in one place while keeping your data on your own machine. Candivana has no subscription, telemetry, or required cloud account.

![Status](https://img.shields.io/badge/status-active-success.svg)
![Docker](https://img.shields.io/badge/docker-required-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

![Candivana board](docs/screenshots/board.png)

## Features

- **Application board** — manage your pipeline with drag-and-drop, search, filters, starring, and archiving.
- **Interview tracking** — record each stage, date, result, and note; view upcoming activity in the calendar.
- **Reusable motivation letters** — assemble letter versions from reusable paragraphs, preview exact A4 page breaks, and export to PDF.
- **CV and document library** — store CV variants and keep the exact documents sent with each application.
- **Analytics** — see application activity, interview rates, offer rates, and funnel conversion.
- **Optional AI assistance** — extract details from job posts, draft letter paragraphs, and summarize your pipeline using any OpenAI-compatible API or local model.
- **Your data stays yours** — self-host with Docker, keep files locally, export applications as JSON, and back up everything yourself.

## Quick start

Requirements: Docker with Compose v2, GNU Make, and OpenSSL. On Windows, run these commands in WSL2.

```bash
git clone https://github.com/swangarch/candivana.git
cd candivana
make init
make up
```

Open [http://localhost](http://localhost), create an account, and start tracking applications. Candivana does not include a default user or password.

The first build may take a few minutes. Check progress with:

```bash
docker compose ps
make logs
```

### Common commands

```bash
make up       # Start the app
make down     # Stop the app
make build    # Rebuild after updating
make logs     # Follow service logs
```

To update Candivana:

```bash
make down
git pull
make build
```

Application data is stored in `./data/` and uploaded documents in `./uploads/`. Back up both directories; stopping or rebuilding the app does not remove them.

To grant administrator access to an existing account:

```bash
make set-admin EMAIL=you@example.com
```

AI features are optional. Configure an OpenAI-compatible endpoint, API key, and model from **AI Settings**; the rest of the app works without them.

For production deployment, see [DEPLOY.md](DEPLOY.md). For development and pull requests, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
