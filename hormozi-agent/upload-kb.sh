#!/usr/bin/env bash
# Sobe os 23 documentos da KB do Hormozi para o RAG da Donna e gateia o acesso
# só para o agente `hormozi`.
#
# Pré-requisitos:
#   - Backend com OPENAI_API_KEY configurado (embeddings).
#   - KB_API : base /v1/knowledge do backend de produção
#              ex.: https://SEU-BACKEND/v1/knowledge   (sem barra no fim)
#   - KB_TOKEN: JWT do usuário logado (conta onde a KB deve viver).
#              Pegue no navegador (logado em prod): DevTools > Application >
#              Local Storage > token do supabase (campo access_token), ou copie
#              o header Authorization de qualquer request /v1/... na aba Network.
#
# Uso:
#   KB_API="https://seu-backend/v1/knowledge" KB_TOKEN="eyJ..." bash hormozi-agent/upload-kb.sh
set -euo pipefail

: "${KB_API:?defina KB_API (ex: https://seu-backend/v1/knowledge)}"
: "${KB_TOKEN:?defina KB_TOKEN (JWT do usuario logado)}"

DIR="$(cd "$(dirname "$0")" && pwd)/knowledge-base"
ok=0; fail=0
for f in "$DIR"/*.md; do
  name="$(basename "$f")"
  resp="$(curl -s -X POST "$KB_API/documents" \
    -H "Authorization: Bearer $KB_TOKEN" \
    -F "file=@$f;type=text/markdown" \
    -F "folder=hormozi")"
  docid="$(printf '%s' "$resp" | sed -n 's/.*"doc_id":"\([^"]*\)".*/\1/p')"
  if [ -z "$docid" ]; then
    echo "FALHOU  $name  -> $resp"; fail=$((fail+1)); continue
  fi
  curl -s -X POST "$KB_API/documents/$docid/access" \
    -H "Authorization: Bearer $KB_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"agents":["hormozi"]}' >/dev/null
  echo "OK      $name  -> $docid  (gateado p/ hormozi)"
  ok=$((ok+1))
done
echo "---"
echo "Indexados: $ok | Falhas: $fail"
