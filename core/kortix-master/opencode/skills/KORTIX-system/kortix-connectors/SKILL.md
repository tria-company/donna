---
name: kortix-connectors
description: "External service connectors (OAuth, API key, CLI, custom) for the Kortix sandbox, plus Pipedream integrations. Use when the user wants to list/add/remove connectors, connect an external service, or search/run actions across Pipedream's 2000+ apps. Covers connector_* tools, kconnectors CLI, kpipedream CLI. NOTE: connectors do NOT represent Telegram/Slack channels — use kortix-channels for those. Triggers: 'connector', 'conectar serviço', 'integração', 'pipedream', 'oauth', 'api key de serviço'."
---

# Connectors

Connectors track what external services are connected and how (OAuth, API key, CLI, custom).

**Important:** Connectors do **not** represent Telegram/Slack channels anymore.
Messaging channels live in the separate `channels` system and must be checked via `kchannel` or `/kortix/channels` — never via `connector_list`.

**Tools:**

| Tool | Purpose |
|---|---|
| `connector_list` | List connectors |
| `connector_get` | Get details |
| `connector_setup` | Create/update connector |
| `connector_remove` | Delete connector |

**CLI (via bash):**
```bash
kconnectors list [--filter <text>]     # List all connectors
kconnectors get <name>                 # Get connector details
kconnectors add <json>                 # Create/update (JSON array or single object)
kconnectors remove <name> [<name>...]  # Delete by name
```

Output is always JSON. Examples:
```bash
kconnectors list                           # All connectors
kconnectors list --filter api-key          # Filter by source
kconnectors get stripe                     # Get one
kconnectors add '{"name":"github","description":"kortix-ai org","source":"cli"}'
kconnectors remove github
```

**Pipedream CLI (via bash — OAuth integrations):**
```bash
kpipedream search [--query <text>]              # Search 2000+ Pipedream apps
kpipedream connect --app <slug>                 # Get OAuth connect URL
kpipedream list                                 # List connected integrations
kpipedream actions --app <slug> [--query <text>] # List available actions for an app
kpipedream run --app <slug> --action <key> [--props <json>]  # Run an action
kpipedream request --app <slug> --url <url> [--method GET]   # Proxy API request
kpipedream exec --app <slug> --code <code>      # Execute custom code with proxyFetch
```
