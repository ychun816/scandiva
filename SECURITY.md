# Security Policy

## Supported version

Security fixes are applied to the latest version on the `main` branch.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use GitHub's **Security** tab and select **Report a vulnerability** to open a private repository security advisory. Include reproduction steps, affected endpoints or files, expected impact, and any suggested mitigation.

Do not include real CVs, cover letters, job applications, API keys, session cookies, database files, or other personal data in a report. Use minimal fictional examples.

## Deployment responsibilities

Candivana is self-hosted. Operators are responsible for:

- generating unique JWT and infrastructure secrets;
- keeping Docker, Node.js images, and dependencies updated;
- restricting access to the host and backups;
- using HTTPS for deployments reachable from the internet;
- backing up and protecting the SQLite database and uploaded documents;
- rotating any credential that may have been exposed.
