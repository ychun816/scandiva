# Candivana — Production Deployment & CD Guide

Architecture: **Cloudflare Tunnel ingress + GitHub Actions SSH auto-deploy**.

```
Browser ──HTTPS──▶ Cloudflare edge (TLS) ──tunnel──▶ cloudflared ─▶ web:80 ─▶ api:3000
```

- The server exposes **no inbound application ports** (not even 80/443); cloudflared dials out.
- TLS terminates at the Cloudflare edge — **no certbot needed**.
- On every push to `main` that passes CI, GitHub Actions rebuilds the production stack over SSH.

---

## 1. What you need to prepare (one-time)

### 1. Server
```bash
# Install Docker + Compose plugin (Ubuntu example)
curl -fsSL https://get.docker.com | sh

# Create a dedicated non-root deploy user and add it to the docker group
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy

# Clone the repo as that user
sudo -u deploy git clone https://github.com/<your-username>/<your-repo>.git /home/deploy/candivana
```

### 2. Production environment variables (on the server, **never committed to git**)
```bash
cd /home/deploy/candivana
cp .env.production.example .env.production
# Edit .env.production and fill in at least:
#   JWT_SECRET   ← generate with `openssl rand -base64 48`; must be ≥32 chars or production refuses to start
#   CORS_ORIGIN  ← https://your-domain
#   TUNNEL_TOKEN ← see next step
```

### 3. Cloudflare Tunnel
In the **Cloudflare Zero Trust dashboard → Networks → Tunnels**:
1. Create (or reuse) a tunnel, choose the **Docker** install method, and copy the **token** it gives you into `TUNNEL_TOKEN` in `.env.production`.
2. Add a **Public Hostname** for this tunnel:
   - Subdomain/Domain: your domain
   - Service: `HTTP` → `web:80` (note: this is the container name — cloudflared and web share the same compose network, so it resolves)
3. Cloudflare creates the DNS record for you automatically (orange-cloud proxied).

> If you previously ran cloudflared on the host via systemd, stop it first (`sudo systemctl disable --now cloudflared`) — this setup manages cloudflared inside compose.

### 4. GitHub repository secrets
In the repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `SSH_HOST` | Server public IP or domain |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | Full contents of the deploy private key (see below) |
| `SSH_PORT` | SSH port (leave empty for default 22) |
| `DEPLOY_DIR` | `/home/deploy/candivana` |

Then, on the same page under the **Variables** tab, add a repository variable **`DEPLOY_ENABLED` = `true`** to enable auto-deploy. Until you add this variable, the `deploy` job is skipped automatically and the pipeline stays green.

Generate the deploy key pair:
```bash
ssh-keygen -t ed25519 -C "github-cd" -f cd_key -N ""
# Install the public key for the server's deploy user:
ssh-copy-id -i cd_key.pub deploy@your-server      # or append manually to ~deploy/.ssh/authorized_keys
# Paste the full contents of the private key cd_key into the GitHub secret SSH_KEY, then delete cd_key locally
```

### 5. First manual start + create admin
```bash
cd /home/deploy/candivana
docker compose -f docker-compose.prod.yml up -d --build
# Create the admin account (pick a strong password yourself — there is no default account)
docker compose -f docker-compose.prod.yml exec \
  -e ADMIN_EMAIL=you@example.com \
  -e ADMIN_PASSWORD='your-strong-password' \
  api node scripts/create_admin.js
```

Open `https://your-domain` to verify. From here on, CD takes over.

---

## 2. How auto-deploy works

`.github/workflows/ci.yml` has three jobs:

1. `backend` — runs the backend test suite + production dependency audit
2. `frontend` — TypeScript type check + build
3. `deploy` — runs **only on pushes to `main` where both jobs above pass**; SSHes into the server and executes `scripts/deploy.sh`

What `scripts/deploy.sh` does: `git reset --hard origin/main` (preserves `.env.production` and the data volumes) → `docker compose -f docker-compose.prod.yml up -d --build` → prune dangling images.

So the day-to-day flow is: **change code → push to main → CI green → live automatically**. Manual rollback: on the server, `git reset --hard <old commit>` then `./scripts/deploy.sh`.

---

## 3. Security hardening (strongly recommended, step by step)

### Server
```bash
# Firewall: deny inbound by default, allow only SSH (the app goes out through the tunnel — no need to open 80/443)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # if you changed the SSH port, use that port instead
sudo ufw enable

# SSH hardening: key-only, no root, no passwords
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# fail2ban against SSH brute force
sudo apt install -y fail2ban && sudo systemctl enable --now fail2ban

# Automatic security updates
sudo apt install -y unattended-upgrades
```

> Advanced (optional): put SSH behind Cloudflare Tunnel too, so even port 22 isn't exposed to the internet — GitHub Actions connects via `cloudflared access`. This gets the server to **zero inbound ports**.

### Application layer (already built into the code)
- Weak/placeholder JWT secrets fail fast in production (`backend/src/config/env.js`).
- Cookies in production use `Secure` + `httpOnly` + `SameSite=Lax`.
- Private files (CVs / cover letters / resumes) require login + ownership checks to download.
- Auth endpoints are rate-limited (429); `trust proxy` is configured to get the real client IP.
- Uploads and domain fields are validated; account deletion runs in a transaction.
- Production does **not** seed a default admin.

### Cloudflare dashboard
- **SSL/TLS mode**: `Full` (with a tunnel, edge-to-origin is already encrypted).
- Enable **WAF managed rules** and **Bot Fight Mode**, and add a **Rate Limiting** rule for `/api/auth/*`.
- (Optional but recommended) Use **Cloudflare Access** to put an extra identity layer (email OTP / SSO) in front of `/admin`, so the admin panel stays unreachable even if the application layer has an issue.

---

## 4. Backups

Data lives in the named volumes `api-data` (SQLite) and `api-uploads` (resume files). Add a cron job:
```bash
# Back up the database and uploads directory to ~/backups daily at 3:00
0 3 * * * cd /home/deploy/candivana && \
  docker compose -f docker-compose.prod.yml exec -T api sh -c 'cat /app/data/prod.db' > ~/backups/prod-$(date +\%F).db && \
  docker run --rm -v candivana-own-data_api-uploads:/u -v ~/backups:/b alpine tar czf /b/uploads-$(date +\%F).tgz -C /u .
```
> The volume name prefix depends on the project directory name — confirm the actual names with `docker volume ls`.

---

## 5. Common operations commands

```bash
cd /home/deploy/candivana
docker compose -f docker-compose.prod.yml ps            # status
docker compose -f docker-compose.prod.yml logs -f api   # backend logs
docker compose -f docker-compose.prod.yml logs -f cloudflared  # tunnel logs
docker compose -f docker-compose.prod.yml restart       # restart
./scripts/deploy.sh                                     # trigger a deploy manually
```
