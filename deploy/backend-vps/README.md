# Backend na VPS (HostHatch)

Sobe o **backend** (`apps/api`, Bun+Hono :8008) como container Docker, atrás do Caddy (HTTPS automático).
O **frontend** vai pra Vercel (ver `docs/deploy-split-vercel-hosthatch.md`). **Nenhuma pasta precisa ser movida** — o backend já é empacotável pelo `apps/api/Dockerfile`.

## Pré-requisitos
- VPS Ubuntu na HostHatch com **Docker** + **Docker Compose** instalados.
- Um domínio apontando pra VPS: registro **A** de `api.SEU-DOMINIO.com` → IP da VPS.
- Credenciais: Cloud Supabase, Daytona, OpenRouter/OpenAI.

## Passo a passo
1. **Clone o repo na VPS** (precisa da raiz pro build do monorepo):
   ```bash
   git clone <seu-repo> kortix && cd kortix
   ```
2. **Construa a imagem do backend** (a partir da RAIZ do repo):
   ```bash
   docker build --build-arg SERVICE=apps/api -f apps/api/Dockerfile -t kortix-api:latest .
   ```
3. **Configure o env**:
   ```bash
   cd deploy/backend-vps
   cp .env.example .env
   # preencha .env (Supabase, Daytona, OpenRouter, e o CORS_ALLOWED_ORIGINS com o domínio da Vercel)
   # gere os segredos: openssl rand -hex 32   (API_KEY_SECRET e TUNNEL_SIGNING_SECRET)
   ```
4. **Ajuste o `Caddyfile`**: troque `api.SEU-DOMINIO.com` e o e-mail.
5. **Suba**:
   ```bash
   docker compose up -d
   docker compose logs -f api      # acompanhe o boot (ensureSchema roda aqui)
   ```
6. **Teste**: `curl https://api.SEU-DOMINIO.com/health` (ou a rota de health da API).

## Atualizar (deploy de nova versão)
```bash
git pull
docker build --build-arg SERVICE=apps/api -f apps/api/Dockerfile -t kortix-api:latest .
cd deploy/backend-vps && docker compose up -d
```

## Ligação com o frontend
- Aqui (VPS): `CORS_ALLOWED_ORIGINS` deve conter o domínio do front na Vercel.
- Na Vercel: `NEXT_PUBLIC_BACKEND_URL=https://api.SEU-DOMINIO.com`.
Detalhes e o lado Vercel: `docs/deploy-split-vercel-hosthatch.md`.
