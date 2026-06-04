---
name: lavalink-client v2 NodeManager crash fix
description: lavalink-client v2 emits raw error events on nodeManager — missing listener crashes Node.js with ERR_UNHANDLED_ERROR
---

## Rule
After creating a `LavalinkManager`, immediately attach an `error` listener to `manager.nodeManager` before any connection attempt:

```js
manager.nodeManager.on('error', (node, error) => {
  logger.error(`NodeManager error [${node?.id}]: ${error?.message || error}`);
});
```

Also set `closeOnError: false` in the node options so Lavalink connection failures don't kill the player.

**Why:** lavalink-client v2 emits errors at two levels: `LavalinkManager` (application-level `nodeError` event) AND raw Node.js `EventEmitter` `error` events on `NodeManager`. If `NodeManager` has no `error` listener, Node.js throws `ERR_UNHANDLED_ERROR` which crashes the process — even if `uncaughtException` is handled.

**How to apply:** Any time you create a `LavalinkManager`, add the `nodeManager.on('error', ...)` listener in the same function, right after construction.
