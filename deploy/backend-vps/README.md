# Backend na VPS (HostHatch) — com sslip.io

Sobe o **backend** (`apps/api`, Bun+Hono :8008) como container Docker, atrás do Caddy (HTTPS automático).
O **frontend** vai pra Vercel (ver `docs/deploy-split-vercel-hosthatch.md`). **Nenhuma pasta precisa ser movida** — o backend já é empacotável pelo `apps/api/Dockerfile`.

Usamos **sslip.io**: o domínio `api.<IP-DA-VPS>.sslip.io` resolve sozinho pro IP da VPS — **sem configurar DNS**.

## Pré-requisitos
- VPS Ubuntu na HostHatch com **Docker** + **Docker Compose** (≥4 GB RAM recomendado pro build).
- Portas **80** e **443** abertas (firewall do painel + `ufw`).
- Credenciais: Cloud Supabase, Daytona, OpenRouter/OpenAI.

## Passo a passo
1. **Conecte e instale o Docker:**
   ```bash
   ssh root@SEU-IP
   curl -fsSL https://get.docker.com | sh
   ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
   ```
2. **Clone o repo** (precisa da raiz pro build do monorepo):
   ```bash
   git clone https://github.com/tria-company/donna.git && cd donna
   ```
3. **Construa a imagem do backend** (a partir da RAIZ do repo):
   ```bash
   docker build --build-arg SERVICE=apps/api -f apps/api/Dockerfile -t kortix-api:latest .
   ```
4. **Configure o env:**
   ```bash
   cd deploy/backend-vps
   cp .env.example .env && nano .env
   # Supabase, Daytona, OpenRouter/OpenAI; CORS_ALLOWED_ORIGINS = URL do front na Vercel
   # gere os segredos: openssl rand -hex 32   (API_KEY_SECRET e TUNNEL_SIGNING_SECRET)
   ```
5. **Ajuste o `Caddyfile`**: troque `SEU-IP` pelo IP da VPS (com pontos) e o e-mail.
   Ex.: IP `203.0.113.45` → `api.203.0.113.45.sslip.io`. **Não precisa mexer em DNS.**
6. **Suba:**
   ```bash
   docker compose up -d
   docker compose logs -f api      # acompanhe o boot (ensureSchema roda aqui)
   ```
7. **Teste:** `curl https://api.SEU-IP.sslip.io/health` → deve dar **200** com TLS válido.

## Atualizar (nova versão)
```bash
git pull
docker build --build-arg SERVICE=apps/api -f apps/api/Dockerfile -t kortix-api:latest .
cd deploy/backend-vps && docker compose up -d
```

## Ligação com o frontend
- Aqui (VPS): `CORS_ALLOWED_ORIGINS` deve conter a URL do front na Vercel.
- Na Vercel: `NEXT_PUBLIC_BACKEND_URL=https://api.SEU-IP.sslip.io`.
Detalhes e o lado Vercel: `docs/deploy-split-vercel-hosthatch.md`.

> ⚠️ Não rode dois backends ao mesmo tempo na mesma Supabase (o scheduler/cron duplicaria).
