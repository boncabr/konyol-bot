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

  // Primary node from env
  if (process.env.LAVALINK_HOST) {
    nodes.push({
      id: 'node-1',
      host: process.env.LAVALINK_HOST,
      port: parseInt(process.env.LAVALINK_PORT || '443', 10),
      password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
      secure: process.env.LAVALINK_SECURE === 'true',
      selfSigned: process.env.LAVALINK_SELF_SIGNED === 'true',
      retryAmount: 15,
      retryDelay: 5000,
    });
  }

  // Fallback node 2 from env
  if (process.env.LAVALINK_HOST_2) {
    nodes.push({
      id: 'node-2',
      host: process.env.LAVALINK_HOST_2,
      port: parseInt(process.env.LAVALINK_PORT_2 || '443', 10),
      password: process.env.LAVALINK_PASSWORD_2 || 'youshallnotpass',
      secure: process.env.LAVALINK_SECURE_2 === 'true',
      selfSigned: process.env.LAVALINK_SELF_SIGNED_2 === 'true',
      retryAmount: 15,
      retryDelay: 5000,
    });
  }

  // Fallback node 3 from env
  if (process.env.LAVALINK_HOST_3) {
    nodes.push({
      id: 'node-3',
      host: process.env.LAVALINK_HOST_3,
      port: parseInt(process.env.LAVALINK_PORT_3 || '443', 10),
      password: process.env.LAVALINK_PASSWORD_3 || 'youshallnotpass',
      secure: process.env.LAVALINK_SECURE_3 === 'true',
      selfSigned: process.env.LAVALINK_SELF_SIGNED_3 === 'true',
      retryAmount: 15,
      retryDelay: 5000,
    });
  }

  // Fallback node 4 from env
  if (process.env.LAVALINK_HOST_4) {
    nodes.push({
      id: 'node-4',
      host: process.env.LAVALINK_HOST_4,
      port: parseInt(process.env.LAVALINK_PORT_4 || '443', 10),
      password: process.env.LAVALINK_PASSWORD_4 || 'youshallnotpass',
      secure: process.env.LAVALINK_SECURE_4 === 'true',
      selfSigned: process.env.LAVALINK_SELF_SIGNED_4 === 'true',
      retryAmount: 15,
      retryDelay: 5000,
    });
  }

  // Fallback node 5 from env
  if (process.env.LAVALINK_HOST_5) {
    nodes.push({
      id: 'node-5',
      host: process.env.LAVALINK_HOST_5,
      port: parseInt(process.env.LAVALINK_PORT_5 || '443', 10),
      password: process.env.LAVALINK_PASSWORD_5 || 'youshallnotpass',
      secure: process.env.LAVALINK_SECURE_5 === 'true',
      selfSigned: process.env.LAVALINK_SELF_SIGNED_5 === 'true',
      retryAmount: 15,
      retryDelay: 5000,
    });
  }

  // Log detected nodes for debugging
  if (nodes.length > 0) {
    console.log(`[Config] Detected ${nodes.length} Lavalink node(s):`, nodes.map(n => `${n.id} (${n.host}:${n.port})`).join(', '));
  } else {
    console.warn('[Config] ⚠️  No Lavalink nodes configured! Set LAVALINK_HOST and other variables.');
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
      { name: 'Lofi Girl',       url: 'https://ice6.somafm.com/lush-128-mp3',        emoji: '📻' },
      { name: 'Synthwave Radio', url: 'https://ice6.somafm.com/synphaera-128-mp3',   emoji: '🌆' },
      { name: 'Jazz & Blues',    url: 'https://ice4.somafm.com/jazz24-128-mp3',      emoji: '🎷' },
      { name: 'Chillhop',        url: 'https://ice6.somafm.com/groovesalad-128-mp3', emoji: '🐸' },
      { name: 'Deep Focus',      url: 'https://ice6.somafm.com/dronezone-128-mp3',   emoji: '🧘' },
    ],
  },

  music: {
    defaultVolume: parseInt(process.env.DEFAULT_VOLUME || '100', 10),
    maxQueueSize: 500,
    maxDuration: parseInt(process.env.MAX_DURATION || '28800000', 10),
    searchPlatform: 'ytsearch',
    leaveOnEmptyDelay: 30000,
    leaveOnEndDelay: 30000,
    voiceChannelBitrate: 384000,
  },

  // ─── Audio Stereo Configuration ───────────────────────────────────────────
  audio: {
    sampleRate: 48000,            // 48 kHz — Discord Opus standard (terbaik untuk stereo)
    channels: 2,                  // Stereo (2 channel)
    opusEncodingQuality: 10,      // Max quality (0-10, default 10)
    resamplingQuality: 'HIGH',    // HIGH, MEDIUM, LOW — untuk resampling audio
    stereoMix: true,              // Enable stereo mixing/channel mix filter
    stereoDepth: 0.5,             // Stereo effect depth (0.0-1.0)
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

  lyrics: {
    // Opsional: API key Genius untuk fallback lirik teks
    // Dapatkan dari https://genius.com/api-clients (Client Access Token)
    geniusApiKey: process.env.GENIUS_API_KEY || null,
  },

  colors: {
    primary: 0x5865F2,
    success: 0x57F287,
    warning: 0xFEE75C,
    error: 0xED4245,
    info: 0x5865F2,
  },
};
