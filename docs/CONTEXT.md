# docs — Specs & handoffs

Documentos de referência: especificações técnicas, handoffs e guias de release/operação. **Não é
código** — é o "porquê" e o "como" das decisões. Para o código, vá pelo roteamento do `CLAUDE.md` raiz.

## O que vive aqui
- **Specs** (`*-spec.md`): desenho técnico de um subsistema (ex.: `instance-three-layer-health-and-actions-spec.md`, `opencode-config-failsafe-spec.md`, `kortix-agent-os-framework-cloud-spec.md`).
- **Handoffs** (`*-handoff.md` / `*-handover.md`): passagem de contexto de um trabalho (ex.: `admin-panel-handoff.md`, `config-degradation-visual-handover.md`).
- **Guias** de release/infra (ex.: `development-release-guide.md`, `justavps-restart-hardening-spec.md`).

## Padrões que seguimos
- Nome **descritivo em kebab-case**; sufixo que indica o tipo (`-spec`, `-handoff`, `-guide`).
- Um assunto por arquivo. Escrito em **PT-BR** (termos técnicos em EN quando natural).
- Spec viva: quando a arquitetura muda, atualize a spec correspondente (não deixe divergir do código).

## Padrões que evitamos
- Despejar spec dentro do `CLAUDE.md` (ele é só o mapa). Documento gigante cobrindo vários assuntos.
