---
name: kortix-triggers
description: "Cron schedules + webhook dispatch + action runner for the Kortix sandbox. Use when the user wants to create, inspect, pause, resume, run, sync, or delete triggers — scheduled jobs, webhooks, recurring prompts/commands/HTTP calls. Covers the `triggers` tool, trigger shape (source cron/webhook, action prompt/command/http), .kortix/triggers.yaml sync, cron/webhook execution flow. Triggers: 'agendar', 'cron', 'webhook', 'trigger', 'schedule', 'recurring job', 'rodar todo dia'."
---

# Triggers

The trigger system is a **unified scheduler + webhook dispatcher + action runner** built around four pieces:

1. **Config file** → `.kortix/triggers.yaml`
2. **Runtime state DB** → `.kortix/kortix.db` tables `triggers` + `trigger_executions`
3. **Runtime manager** → `TriggerManager`
4. **Execution surfaces** → cron jobs, webhook routes, and the `triggers` tool

### What is the actual source of truth?

- **`triggers.yaml` is the source of truth for trigger definitions/config**: what triggers exist, their source, action, prompt/command/http config, context extraction, etc.
- **`kortix.db` is the source of truth for runtime state**: `is_active`, `last_run_at`, `next_run_at`, `session_id`, `event_count`, and execution history.

That split is intentional:

- YAML is declarative and git-friendly.
- SQLite stores mutable runtime state that should not live in git.

### Boot sequence

The triggers plugin is loaded from `opencode/plugin/kortix-system/triggers.ts` with:

- `directory: resolveKortixWorkspaceRoot(import.meta.dir)`
- `webhookHost: "0.0.0.0"`
- `webhookPort: KORTIX_TRIGGER_WEBHOOK_PORT || 8099`
- `publicBaseUrl: SANDBOX_PUBLIC_URL || "http://localhost:8000"`

On startup, `TriggerManager.start()` does this:

1. Opens `.kortix/kortix.db`
2. Creates/migrates the `triggers` and `trigger_executions` tables
3. Runs one-time migration code from older trigger systems
4. Syncs `.kortix/triggers.yaml` into the DB
5. Rebuilds runtime state:
   - schedules active cron jobs
   - rebuilds active webhook routes
6. Starts the internal webhook server on port `8099`
7. Starts watching `.kortix/triggers.yaml` for changes

### How trigger creation works end-to-end

For agent-driven work, the intended control plane is the **`triggers` tool**.

If a user asks you to create, inspect, pause, resume, run, or sync triggers, start with the `triggers` tool — not bash, not `curl`, and not an invented CLI.

`triggers action=create ...` flows like this:

1. Tool call enters `triggers/src/plugin.ts`
2. Plugin calls `TriggerManager.createTrigger(...)`
3. `TriggerStore.create(...)` writes the trigger row to SQLite
4. For cron triggers, `next_run_at` is computed immediately
5. `TriggerYaml.writeThrough()` flushes current DB config back to `.kortix/triggers.yaml`
6. `TriggerManager.rebuildRuntime()` applies the new config live
   - new cron jobs are scheduled immediately
   - new webhook routes become active immediately

So the tool path is the cleanest path because it updates **DB + YAML + live runtime** in one flow.

### How to use trigger tools

If the user asks for trigger work, use the unified `triggers` tool with one of these patterns:

```text
triggers action=list
triggers action=create name="Daily Report" source_type=cron cron_expr="0 0 9 * * *" timezone="UTC" action_type=prompt prompt="Generate the daily report"
triggers action=create name="Deploy Hook" source_type=webhook path="/hooks/deploy" method="POST" secret="mysecret" action_type=command command="bash" args='["-c","./deploy.sh"]'
triggers action=get trigger_id="<id-or-name>"
triggers action=update trigger_id="<id>" prompt="Updated prompt"
triggers action=pause trigger_id="<id>"
triggers action=resume trigger_id="<id>"
triggers action=run trigger_id="<id>"
triggers action=executions trigger_id="<id>"
triggers action=delete trigger_id="<id>"
triggers action=sync
```

Rules:

- `get` accepts id or name.
- `run`, `pause`, `resume`, `update`, `delete`, and `executions` should use the real trigger **id**.
- Prefer `triggers` over alias tools.
- Do not use bash or `curl` when the goal is to manage triggers from the agent.

### Trigger shape

Each trigger has:

- a **source**: `cron` or `webhook`
- an **action**: `prompt`, `command`, or `http`
- optional **context extraction** rules
- optional **session reuse** behavior for prompt actions

#### Source types

- `source_type=cron`
  - required: `cron_expr`
  - optional: `timezone`
- `source_type=webhook`
  - required: `path`
  - optional: `method`, `secret`

#### Action types

- `action_type=prompt`
  - sends a rendered prompt into an OpenCode session
  - required: `prompt`
  - optional: `agent_name`, `model_id`, `session_mode`
- `action_type=command`
  - runs a shell command via `Bun.spawn`
  - required: `command`
  - optional: `args`, `workdir`, `env`, `timeout_ms`
- `action_type=http`
  - performs an outbound HTTP request
  - required: `url`
  - optional: `method`, `headers`, `body_template`, `timeout_ms`

### Cron execution flow

For each active cron trigger, `TriggerManager.scheduleCron()` creates a `Croner` job.

When the schedule fires:

1. Croner invokes the callback
2. `ActionDispatcher.dispatch(trigger.id, { type: "cron.tick", ... })` runs
3. A row is inserted into `trigger_executions` with `status=running`
4. Overlap is prevented: if the same trigger is already running, a `skipped` execution is recorded instead
5. The configured action executes
6. On success:
   - execution row is marked `completed`
   - `last_run_at` is updated
   - `next_run_at` is recomputed
   - `session_id` is persisted when the action created/reused a session
7. On failure:
   - execution row is marked `failed`
   - `error_message` is stored

### Webhook execution flow

There are **two HTTP layers** for webhooks:

1. **Kortix Master HTTP layer** on port `8000`
2. **Internal trigger webhook server** on port `8099`

External requests hit `/hooks/*` on the master server. The master server:

- skips normal auth for `/hooks/*`
- forwards the request to `http://localhost:8099{pathname}`
- forwards `x-kortix-trigger-secret` / `x-kortix-opencode-trigger-secret`

The internal webhook server then:

1. Matches `METHOD + PATH` against the active route map
2. Verifies the per-trigger secret header if configured
3. Reads request body + headers
4. Hands the payload to `TriggerManager.dispatchWebhook(...)`
5. `dispatchWebhook(...)` finds the matching trigger row
6. The payload is normalized into an event and sent to `ActionDispatcher.dispatch(...)`

So the external webhook URL is effectively:

`http://localhost:8000/hooks/...`

but the actual route matching and trigger dispatch happens on the internal `8099` server.

### Channel-specific webhook handling

`TriggerManager.dispatchWebhook()` has special preprocessing for:

- `/hooks/telegram/<configId>`
- `/hooks/slack/<configId>`

Those payloads are normalized before action dispatch. The system injects channel-specific fields like:

- `_channel_prompt`
- `_session_key`
- `_channel_platform`
- `_channel_user_id`
- `_channel_chat_id`

Slack challenge requests are short-circuited, and Slack event IDs are deduplicated for 5 minutes.

### Prompt action flow

Prompt actions render text from:

- the configured `prompt` template
- flattened top-level event data
- optional extracted values from `context.extract`
- optional raw event JSON inside `<trigger_event>...</trigger_event>`

Session handling works like this:

- `session_mode="new"` → always create a new session
- `session_mode="reuse"` → reuse prior session
- if `context.session_key` is set, the reuse key is dynamically rendered from event data, enabling patterns like “one persistent session per chat/user”

The final prompt is sent with `client.session.promptAsync(...)` to the selected agent/model.

### Command action flow

Command actions:

1. parse `command`, `args`, `workdir`, `env`, `timeout_ms`
2. run via `Bun.spawn(...)`
3. capture `stdout`, `stderr`, and exit code
4. truncate large output at 50k chars
5. store results on the execution row

### HTTP action flow

HTTP actions:

1. render request headers/body from event data
2. `fetch(url, ...)`
3. capture response status + body
4. truncate large bodies at 50k chars
5. store results on the execution row

### YAML sync behavior

`TriggerYaml` watches `.kortix/triggers.yaml` and reconciles it into SQLite.

Important behavior:

- If the file does not exist, an empty file is created
- YAML changes are debounced and synced
- There is also a 30-second periodic reconcile fallback
- Sync is **name-based**:
  - YAML entries are upserted by `name`
  - DB triggers missing from YAML are removed
- Config fields are overwritten from YAML
- Runtime fields are preserved in DB

### The actual interfaces you may see

There are two real interfaces in the codebase:

1. **Agent/tool interface** → the `triggers` tool in the OpenCode plugin
2. **HTTP API** → `/kortix/triggers` in `src/routes/triggers.ts`

Use the **tool** when you are acting as the agent and want immediate runtime changes.

### Important implementation notes

- Do **not** assume `curl http://localhost:8000/triggers` is the trigger API. The master HTTP API is mounted at **`/kortix/triggers`**, while webhook delivery is at **`/hooks/*`**.
- Do **not** invent a `ktriggers` CLI. The codebase defines a tool plugin and an HTTP router, not that CLI.
- Manual runs through the **tool** call the dispatcher immediately.
- The HTTP router currently operates more directly on `TriggerStore` + `TriggerYaml` than on `TriggerManager`, so it is not the cleanest mental model for runtime behavior.

### Current sharp edges in the implementation

Be aware of these real code-level nuances:

- `POST /kortix/triggers/:id/run` currently creates an execution row but does **not** dispatch the action itself.
- `POST /kortix/triggers/:id/pause` and `/resume` update DB state directly, but do not call `TriggerManager.rebuildRuntime()`, so live scheduling/route changes are not applied through the same direct path as the tool interface.
- The clean end-to-end path is therefore: **`triggers` tool → TriggerManager → Store/YAML → runtime rebuild → execution**.

### Minimal examples

```text
triggers action=list
triggers action=create name="Daily Report" source_type=cron cron_expr="0 0 9 * * *" action_type=prompt prompt="Generate the daily report" agent_name=general
triggers action=create name="Backup" source_type=cron cron_expr="0 0 2 * * *" action_type=command command="bash" args='["-c","./scripts/backup.sh"]'
triggers action=create name="Deploy Hook" source_type=webhook path="/hooks/deploy" action_type=prompt prompt="Handle deploy" secret=mysecret
triggers action=run trigger_id=xxx
triggers action=executions trigger_id=xxx
triggers action=sync
```
