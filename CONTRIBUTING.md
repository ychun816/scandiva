# Contributing to Candivana

Thank you for helping improve Candivana.

## Before opening an issue

- Search existing issues first.
- Do not include CVs, cover letters, application notes, API keys, database files, logs containing personal data, or `.env` files.
- Use fictional data in screenshots and bug reproductions.
- Report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Local development

The supported development environment is Docker Compose:

```bash
make init
make up
```

Open `http://localhost`. Source directories are mounted into the containers and both frontend and backend reload automatically.

Before submitting a pull request, run:

```bash
cd backend
npm ci
npm test
npm audit --omit=dev --audit-level=high

cd ../frontend
npm ci
npm run build
npm audit --omit=dev --audit-level=high
```

## Pull requests

- Keep changes focused and explain user-visible behavior.
- Add or update tests for backend behavior.
- Confirm that no personal data, secrets, databases, or uploaded documents are included.
- Update README or deployment documentation when setup behavior changes.
- By contributing, you agree that your contribution is licensed under the repository's MIT License.
