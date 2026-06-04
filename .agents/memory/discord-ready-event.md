---
name: Discord.js ready event rename
description: The 'ready' event was renamed to 'clientReady' in discord.js v14; v15 will drop 'ready' entirely
---

## Rule
Use `name: 'clientReady'` (not `'ready'`) for the Discord bot ready event handler.

**Why:** discord.js v14 renamed the event to `clientReady` to distinguish it from the gateway `READY` packet. Using `ready` still works in v14 but emits a deprecation warning; v15 will remove it entirely.

**How to apply:** In any event file that handles the bot startup (once: true, fires when bot logs in), use `name: 'clientReady'`.
