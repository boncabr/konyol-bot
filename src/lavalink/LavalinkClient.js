const { LavalinkManager } = require('lavalink-client');
const config = require('../config/config');
const logger = require('../utils/logger');
const { handleNodeFailure, resetNodeFailCount } = require('../utils/lavalinkRecovery');

function applyTlsSettings(nodes) {
  const selfSignedNodes = nodes.filter((n) => n.secure && n.selfSigned);
  const plainNodes = nodes.filter((n) => !n.secure);

  if (selfSignedNodes.length > 0) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    logger.warn(
      `[TLS] NODE_TLS_REJECT_UNAUTHORIZED=0 diaktifkan karena node berikut pakai self-signed cert: ` +
      selfSignedNodes.map((n) => n.id).join(', ') +
      `. Gunakan LAVALINK_SELF_SIGNED=false jika server sudah pakai certificate dari CA resmi.`
    );
  } else {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (plainNodes.length > 0) {
      logger.info(`[TLS] Node tanpa SSL: ${plainNodes.map((n) => n.id).join(', ')} (ws://, no TLS)`);
    }
  }
}

function buildNodes() {
  return config.lavalink.nodes.map((n) => ({
    authorization: n.password,
    host: n.host,
    port: n.port,
    id: n.id,
    secure: n.secure,
    selfSigned: n.selfSigned,
    retryAmount: 50,
    retryDelay: 5000,
    closeOnError: false,
    requestTimeout: 30000,
  }));
}

function createLavalinkManager(client) {
  const nodes = buildNodes();
  applyTlsSettings(nodes);

  logger.info(
    `Configuring ${nodes.length} Lavalink node(s): ` +
    nodes.map((n) => `${n.id} (${n.secure ? 'SSL' : 'no-SSL'}${n.selfSigned ? '/self-signed' : ''})`).join(', ')
  );

  const manager = new LavalinkManager({
    nodes,
    sendToShard: (guildId, payload) => {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      } catch (err) {
        logger.error(`sendToShard error: ${err.message}`);
      }
    },
    client: {
      id: config.clientId,
      username: 'MusicBot',
    },
    playerOptions: {
      applyVolumeAsFilter: true,
      instaUpdateFiltersFix: true,
      clientBasedPositionUpdateInterval: 100,
      defaultSearchPlatform: config.music.searchPlatform,
      volumeDecrementer: 1.0,
      onDisconnect: {
        autoReconnect: true,
        destroyPlayer: false,
      },
      onEmptyQueue: {
        destroyAfterMs: config.music.leaveOnEmptyDelay,
      },
    },
    autoSkip: true,
    autoSkipOnResolveError: true,
    emitNewSongsOnly: true,
  });

  try {
    if (manager.nodeManager) {
      manager.nodeManager.on('error', (node, error) => {
        const msg = error?.message || (typeof error === 'string' ? error : 'unknown error');
        logger.error(`Lavalink NodeManager raw error [${node?.id || 'unknown'}]: ${msg}`);
        handleNodeFailure(node?.id || 'unknown').catch(() => {});
      });
    }
  } catch (e) {
    logger.warn(`Could not attach nodeManager error listener: ${e.message}`);
  }

  manager.on('nodeConnect', (node) => {
    logger.info(`✅ Lavalink node [${node.id}] (${node.options?.host}) terhubung`);
    resetNodeFailCount(node.id);
  });

  manager.on('nodeDisconnect', (node, reason) => {
    logger.warn(`⚠️  Lavalink node [${node.id}] terputus: ${reason?.reason || 'unknown'} — mencoba reconnect...`);
    handleNodeFailure(node.id).catch(() => {});
  });

  manager.on('nodeError', (node, error) => {
    const msg = error?.message || (typeof error === 'string' ? error : 'connection error');
    logger.error(`❌ Lavalink node [${node?.id || 'unknown'}] error: ${msg}`);
    handleNodeFailure(node?.id || 'unknown').catch(() => {});
  });

  manager.on('nodeReconnect', (node) => {
    logger.info(`🔄 Lavalink node [${node.id}] sedang reconnect...`);
  });

  manager.on('nodeDestroy', (node, destroyReason) => {
    logger.warn(`🗑️  Lavalink node [${node.id}] destroyed: ${destroyReason || 'unknown'}`);
  });

  // ── SponsorBlock Events ────────────────────────────────────────────────────
  // Event ini dikirim oleh Lavalink server (plugin SponsorBlock v3.x)
  // saat segmen sponsor/intro/outro di-skip otomatis.

  manager.on('SegmentsLoaded', (player, track, segments) => {
    if (!segments || segments.length === 0) return;
    const names = segments.map((s) => s.category).join(', ');
    logger.debug(`[SponsorBlock] Segmen dimuat untuk "${track?.info?.title}": ${names}`);
  });

  manager.on('SegmentSkipped', (player, track, segment) => {
    const category = segment?.category || 'unknown';
    const start = segment?.start != null ? Math.floor(segment.start / 1000) : '?';
    const end = segment?.end != null ? Math.floor(segment.end / 1000) : '?';
    logger.info(
      `[SponsorBlock] Segmen di-skip: [${category}] ${start}s → ${end}s ` +
      `di "${track?.info?.title || 'unknown'}"`
    );
  });

  manager.on('ChaptersLoaded', (player, track, chapters) => {
    if (!chapters || chapters.length === 0) return;
    logger.debug(`[SponsorBlock] ${chapters.length} chapter dimuat untuk "${track?.info?.title}"`);
  });

  manager.on('ChapterStarted', (player, track, chapter) => {
    logger.debug(`[SponsorBlock] Chapter dimulai: "${chapter?.name || 'unknown'}" di "${track?.info?.title}"`);
  });

  return manager;
}

module.exports = { createLavalinkManager };
