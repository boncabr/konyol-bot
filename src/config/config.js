require('dotenv').config();

module.exports = {
  prefix: process.env.PREFIX || '?',
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID || '1507649904456241202',
  guildId: process.env.GUILD_ID || null,

  lavalink: {
    nodes: [
      {
        id: 'primary',
        host: process.env.LAVALINK_HOST || 'lavalinkv4.serenetia.com',
        port: parseInt(process.env.LAVALINK_PORT || '443'),
        password: process.env.LAVALINK_PASSWORD || 'https://seretia.link/discord',
        secure: process.env.LAVALINK_SECURE === 'true',
        selfSigned: process.env.LAVALINK_SELF_SIGNED === 'true',
        retryAmount: 15,
        retryDelay: 5000,
      },
      {
        id: 'fallback',
        host: process.env.LAVALINK_HOST_2 || 'lavalink.serenetia.com',
        port: parseInt(process.env.LAVALINK_PORT_2 || '443'),
        password: process.env.LAVALINK_PASSWORD_2 || 'https://dsc.gg/srnti',
        secure: process.env.LAVALINK_SECURE_2 === 'true',
        selfSigned: false,
        retryAmount: 15,
        retryDelay: 5000,
      },
    ],
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
    defaultVolume: parseInt(process.env.DEFAULT_VOLUME || '100'),
    maxQueueSize: 500,
    maxDuration: parseInt(process.env.MAX_DURATION || '7200000'),
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
    port: parseInt(process.env.PORT || '3000'),
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
