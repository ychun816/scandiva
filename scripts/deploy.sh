#!/usr/bin/env bash
# Server-side deploy: bring the running checkout to origin/main and rebuild the
# production stack. Invoked over SSH by the CD workflow (see .github/workflows/ci.yml).
#
# Preconditions on the server:
#   - this repo is cloned (default: ~/candivana)
#   - .env.production exists next to docker-compose.prod.yml
#   - the deploy user can run docker (member of the `docker` group)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "==> Updating source to origin/main"
git fetch --all --prune
git reset --hard origin/main   # untracked/ignored files (.env.production, volumes) are preserved

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production is missing on the server. Aborting." >&2
  exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> Rebuilding and restarting the production stack"
$COMPOSE pull cloudflared || true
$COMPOSE up -d --build

# --- Post-deploy self-check ---------------------------------------------------
# Wait for api + web to report healthy, then verify the full web->api path.
# Any failure exits non-zero, which fails the CD run so a broken deploy is loud.
health_of() {
  docker inspect --format '{{ if .State.Health }}{{ .State.Health.Status }}{{ else }}none{{ end }}' "$1" 2>/dev/null || echo "missing"
}

echo "==> Waiting for containers to become healthy"
DEADLINE=$(( $(date +%s) + 120 ))
for svc in candivana-api candivana-web; do
  until [ "$(health_of "$svc")" = "healthy" ]; do
    if [ "$(date +%s)" -ge "$DEADLINE" ]; then
      echo "ERROR: $svc did not become healthy in time. Recent logs:" >&2
      docker logs --tail 40 "$svc" >&2 || true
      exit 1
    fi
    sleep 3
  done
  echo "    $svc: healthy"
done

echo "==> End-to-end check (web -> api proxy)"
if ! $COMPOSE exec -T web wget -q -O - http://localhost/api/ | grep -q "running"; then
  echo "ERROR: end-to-end check failed (web could not reach the API)." >&2
  $COMPOSE logs --tail 40 api web >&2 || true
  exit 1
fi
echo "    web -> api: OK"

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Current status"
$COMPOSE ps
echo "==> Deploy complete ✓"
