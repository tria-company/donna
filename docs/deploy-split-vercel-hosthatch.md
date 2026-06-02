# Deploy separado: frontend na Vercel + backend na VPS (HostHatch)

## Resumo
O suna-new é um monorepo, mas frontend e backend **deployam de forma independente** — não é preciso
mover/renomear pastas. Cada um já tem sua config:
- **Frontend** (`apps/web`) → **Vercel** (já tem `apps/web/vercel.json`).
- **Backend** (`apps/api`) → **VPS Docker** (já tem `apps/api/Dockerfile`, ciente do monorepo).

O frontend **não importa** código do backend (só `@kortix/shared`), então o build do front na Vercel
não depende do `apps/api`. Os dois se falam por **HTTP** + **CORS**.

```
  Navegador ──► Vercel (apps/web)  ──HTTPS──►  VPS HostHatch (apps/api :8008)  ──►  Cloud Supabase + Daytona
                NEXT_PUBLIC_BACKEND_URL ─────────────┘            └──── CORS_ALLOWED_ORIGINS (domínio Vercel)
```

## 1) Backend → VPS HostHatch
Kit pronto em [`deploy/backend-vps/`](../deploy/backend-vps/README.md). Em resumo:
1. VPS Ubuntu + Docker. **sslip.io: sem DNS** — `api.<IP-DA-VPS>.sslip.io` resolve sozinho.
2. `docker build --build-arg SERVICE=apps/api -f apps/api/Dockerfile -t kortix-api:latest .` (na raiz do repo).
3. `cp deploy/backend-vps/.env.example deploy/backend-vps/.env` e preencher (Supabase, Daytona, OpenRouter, **CORS_ALLOWED_ORIGINS**).
4. Ajustar `Caddyfile` (domínio + e-mail) e `docker compose up -d`.

## 2) Frontend → Vercel
1. **New Project** → importe o repositório Git.
2. **Root Directory = `apps/web`** ← passo-chave (Vercel monorepo). O `pnpm-workspace.yaml` na raiz
   é detectado e o `@kortix/shared` resolve sozinho. Framework: **Next.js** (auto).
3. **Environment Variables** (Project Settings → Environment Variables):
   - `NEXT_PUBLIC_BACKEND_URL = https://api.SEU-IP.sslip.io`  ← aponta pro backend na VPS
   - (demais chaves públicas que o front use — Supabase anon, etc.)
4. Deploy. O `apps/web/vercel.json` já cuida do build (`next build`) e dos branches.

## 3) A ligação (o que conecta os dois)
| Onde | Variável | Valor |
|------|----------|-------|
| Vercel (front) | `NEXT_PUBLIC_BACKEND_URL` | `https://api.SEU-IP.sslip.io` |
| VPS (back) | `CORS_ALLOWED_ORIGINS` | `https://SEU-FRONT.vercel.app` (+ domínio custom) |

- Front lê o backend em [`env-config.ts`](../apps/web/src/lib/env-config.ts) → `BACKEND_URL`.
- Back libera origens extras em [`index.ts`](../apps/api/src/index.ts) → `CORS_ALLOWED_ORIGINS`.

## Checklist de verificação
- [ ] `curl https://api.SEU-IP.sslip.io/health` responde 200 da VPS.
- [ ] No navegador, abrir o app na Vercel → Network mostra chamadas pra `api.SEU-IP.sslip.io` (não localhost).
- [ ] Sem erro de **CORS** no console (se houver, falta o domínio Vercel em `CORS_ALLOWED_ORIGINS`).
- [ ] Login (Supabase) funciona ponta-a-ponta.

## Por que NÃO mover as pastas
Renomear `apps/api`/`apps/web` quebraria Docker, scripts de deploy, CI e testes (caminho literal em 60+
arquivos) e dificultaria puxar updates do **Kortix** (upstream). A separação que o deploy exige é de
**runtime/host**, não de pasta — e isso já está resolvido pelos dois arquivos de config acima.
```
