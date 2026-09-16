require('dotenv').config();

/**
 * Build Lavalink nodes array from environment variables.
 * Supports multiple nodes with automatic failover.
 * Node names are hidden (generic identifiers like 'node-1', 'node-2', etc.)
 * 
 * Environment variables format:
 * - LAVALINK_HOST, LAVALINK_PORT, LAVALINK_PASSWORD, LAVALINK_SECURE, LAVALINK_SELF_SIGNED
 * - LAVALINK_HOST_2, LAVALINK_PORT_2, LAVALINK_PASSWORD_2, LAVALINK_SECURE_2, LAVALINK_SELF_SIGNED_2
 * - LAVALINK_HOST_3, ... (and so on)
 */
function buildLavalinkNodes() {
  const nodes = [];
  let nodeIndex = 1;

  // Scan for LAVALINK_HOST, LAVALINK_HOST_2, LAVALINK_HOST_3, etc.
  for (let i = 1; i <= 10; i++) { // Support up to 10 nodes
    const suffix = i === 1 ? '' : `_${i}`;
    const host = process.env[`LAVALINK_HOST${suffix}`];
    
    // Stop scanning if we hit a gap (no host found for this index)
    if (!host) {
      if (i > 2) break; // Only continue past 1 if we found node 2
      continue;
    }
    
    const port = parseInt(process.env[`LAVALINK_PORT${suffix}`] || '443', 10);
    const password = process.env[`LAVALINK_PASSWORD${suffix}`] || 'youshallnotpass';
    const secure = process.env[`LAVALINK_SECURE${suffix}`] === 'true';
    const selfSigned = process.env[`LAVALINK_SELF_SIGNED${suffix}`] === 'true';

    // Hide node names — use generic identifiers
    nodes.push({
      id: `node-${nodeIndex}`,
      host,
      port,
      password,
      secure,
      selfSigned,
    });
    
    nodeIndex++;
  }

  // Log detected nodes for debugging
  if (nodes.length > 0) {
    console.log(`[Config] Detected ${nodes.length} Lavalink node(s):`, nodes.map(n => `${n.id} (${n.host}:${n.port})`).join(', '));
  }

  return nodes;
}

module.exports = {
  prefix: process.env.PREFIX || '?',
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID || '1507649904456241202',
  guildId: process.env.GUILD_ID || null,

  lavalink: {
    nodes: buildLavalinkNodes(),
  },

  radio: {
    stations: [
      { name: 'Lofi Girl',       url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', emoji: '📻' },
      { name: 'Synthwave Radio', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY', emoji: '🌆' },
      { name: 'Jazz & Blues',    url: 'https://www.youtube.com/watch?v=Dx5qFachd3A', emoji: '🎷' },
      { name: 'Chillhop',        url: 'https://www.youtube.com/watch?v=7NOSDKb0HlU', emoji: '🐸' },
      { name: 'Deep Focus',      url: 'https://www.youtube.com/watch?v=5qap5aO4i9A', emoji: '🧘' },
    ],
  },

  music: {
    defaultVolume: parseInt(process.env.DEFAULT_VOLUME || '80', 10),
    fadeDurationMs: parseInt(process.env.FADE_DURATION_MS || '6000', 10),
    fadeIntervalMs: parseInt(process.env.FADE_INTERVAL_MS || '100', 10),
    maxQueueSize: 500,
    searchPlatform: 'ytmsearch',
    leaveOnEmptyDelay: 30000,
    leaveOnEndDelay: 30000,
    voiceChannelBitrate: 384000,
  },

  cooldowns: {
    default: 3000,
    play: 5000,
    skip: 2000,
    volume: 100,
  },

  keepAlive: {
    port: parseInt(process.env.PORT || '3000', 10),
  },

  colors: {
    primary: 0x5865F2,
    success: 0x57F287,
    warning: 0xFEE75C,
    error: 0xED4245,
    info: 0x5865F2,
  },
};
