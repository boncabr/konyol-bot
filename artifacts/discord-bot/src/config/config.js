require('dotenv').config();

module.exports = {
  prefix: process.env.PREFIX || '?',
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID || '1507649904456241202',
  guildId: process.env.GUILD_ID || null,

  lavalink: {
    nodes: [
      // Primary node — override via Railway env vars
      {
        id: 'primary',
        host: process.env.LAVALINK_HOST || 'lavalinkv4.serenetia.com',
        port: parseInt(process.env.LAVALINK_PORT || '443'),
        password: process.env.LAVALINK_PASSWORD || 'https://seretia.link/discord',
        secure: process.env.LAVALINK_SECURE !== 'true',
      },
      // Fallback node 1 — Jirayu v4 (global, non-SSL)
      ...(process.env.LAVALINK_HOST ? [] : [{
        id: 'fallback1',
        host: 'lavalink.jirayu.net',
        port: 13592,
        password: 'youshallnotpass',
        secure: false,
      }]),
      // Fallback node 2 — HeavenCloud (global, non-SSL)
      ...(process.env.LAVALINK_HOST ? [] : [{
        id: 'fallback2',
        host: '89.106.84.59',
        port: 4000,
        password: 'heavencloud.in',
        secure: false,
      }]),
    ],
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
    defaultVolume: parseInt(process.env.DEFAULT_VOLUME || '100'),
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
    port: parseInt(process.env.PORT || '3000'),
  },

  colors: {
    primary: 0x5865F2,
    success: 0x57F287,
    warning: 0xFEE75C,
    error: 0xED4245,
    info: 0x5865F2,
  },
};
