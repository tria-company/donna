---
name: kortix-channels
description: "Telegram & Slack bot channel management for the Kortix sandbox. Use when the user asks whether they have channels configured, wants to set up / list / enable / disable / remove a Telegram or Slack bot, send messages or files to a chat, read Slack history, or change a channel's agent/model. Covers the kchannel / ktelegram / kslack CLIs. Triggers: 'telegram', 'slack', 'bot', 'canal', 'channel', 'mandar mensagem no telegram', 'configurar bot'."
---

# Channels

Channel CLIs let you manage and communicate via Telegram and Slack bots.

**Source of truth:** Channels are stored in the `channels` SQLite table and exposed via `kchannel` / `/kortix/channels`.
Do **not** use `connector_list` to answer channel questions. Old connector shadow rows may exist transiently during migration, but they are not authoritative.

**If a user asks whether they have channels configured:**
1. Check with `kchannel list` (bash) or `GET /kortix/channels`
2. Report Telegram/Slack channels only from that data
3. Do not infer channel state from connectors

**Management:**
```bash
kchannel list                          # List all connected channels
kchannel info <id>                     # Channel details
kchannel enable|disable <id>           # Toggle on/off
kchannel remove <id>                   # Delete channel
kchannel set <id> --agent X --model Y  # Update settings
```

**Telegram:**
```bash
ktelegram setup --token <BOT_TOKEN> --url <PUBLIC_URL> --created-by <name>  # Set up new bot
ktelegram send --config-id <CHANNEL_ID> --chat <id> --text "msg"              # Send message
ktelegram send --config-id <CHANNEL_ID> --chat <id> --text-file /tmp/msg.txt   # Send complex message
ktelegram send --config-id <CHANNEL_ID> --chat <id> --file /tmp/img.png        # Send file
ktelegram typing --config-id <CHANNEL_ID> --chat <id>                          # Typing indicator
ktelegram me --config-id <CHANNEL_ID>                                          # Bot info
```

**Slack:**
```bash
kslack setup --token <xoxb-TOKEN> --signing-secret <SECRET> --url <PUBLIC_URL>  # Set up new bot
kslack send --config-id <CHANNEL_ID> --channel <id> --text "msg" --thread <ts>   # Send in thread
kslack send --config-id <CHANNEL_ID> --channel <id> --text-file /tmp/msg.txt       # Send complex message
kslack send --config-id <CHANNEL_ID> --channel <id> --file /tmp/report.csv         # Send file
kslack history --config-id <CHANNEL_ID> --channel <id>                              # Read channel history
kslack channels --config-id <CHANNEL_ID>                                            # List channels
kslack users --config-id <CHANNEL_ID>                                               # List users
kslack react --config-id <CHANNEL_ID> --channel <id> --ts <ts> --emoji thumbsup    # Add reaction
kslack manifest --url <PUBLIC_URL>                                                  # Generate Slack app manifest
```

**Channel replies:** Telegram and Slack runtime instructions are provided inline in the inbound message prompt.

**Channel control commands:** `Telegram /...` and `Slack !...` control commands are handled by the channel bridge before messages reach the agent for these commands:
- new / reset
- status
- help
- sessions / session <id>
- agent <name>
- model <provider/model>

**API:** `GET /kortix/channels` returns all configured channels from SQLite.
