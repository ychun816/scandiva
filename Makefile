.PHONY: init up down restart build logs clean prod-up prod-down prod-logs prod-ps set-admin

# Create a local environment file with a random JWT signing secret.
init:
	@if [ -f .env ]; then \
		echo ".env already exists; leaving it unchanged."; \
	else \
		command -v openssl >/dev/null || { echo "openssl is required to generate .env"; exit 1; }; \
		printf 'JWT_SECRET=%s\n' "$$(openssl rand -base64 48)" > .env; \
		echo "Created .env with a random JWT secret."; \
	fi

# Start the local development stack.
up:
	@test -f .env || { echo "Missing .env. Run 'make init' first."; exit 1; }
	docker compose up -d

down:
	docker compose down

restart: down up

build:
	@test -f .env || { echo "Missing .env. Run 'make init' first."; exit 1; }
	docker compose up -d --build

logs:
	docker compose logs -f

# Stops the stack and removes Docker-managed volumes. Host data in ./data and
# ./uploads is intentionally preserved.
clean:
	docker compose down -v

# Production stack (Cloudflare Tunnel; requires .env.production).
prod-up:
	@test -f .env.production || { echo "Missing .env.production. See DEPLOY.md."; exit 1; }
	docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml --env-file .env.production down

prod-logs:
	docker compose -f docker-compose.prod.yml --env-file .env.production logs -f

prod-ps:
	docker compose -f docker-compose.prod.yml --env-file .env.production ps

# Promote an existing registered user. Usage:
#   make set-admin EMAIL=you@example.com
set-admin:
	@test -n "$(EMAIL)" || { echo "Usage: make set-admin EMAIL=you@example.com"; exit 1; }
	docker compose exec -e ADMIN_EMAIL="$(EMAIL)" api node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.update({where:{email:process.env.ADMIN_EMAIL},data:{isAdmin:true}}).then(u=>console.log('Admin:',u.email)).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>p.\$$disconnect())"
