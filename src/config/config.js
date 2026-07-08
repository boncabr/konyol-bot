require('dotenv').config();

function buildNodes() {
  const nodes = [
    {
      id: 'primary',
      host: process.env.LAVALINK_HOST || 'lavalinkv4.serenetia.com',
      port: parseInt(process.env.LAVALINK_PORT || '443'),
      password: process.env.LAVALINK_PASSWORD || 'Ariekonur0',
      secure: process.env.LAVALINK_SECURE !== 'false',
    },
  ];

  if (process.env.LAVALINK_HOST_2) {
    nodes.push({
      id: 'secondary',
      host: process.env.LAVALINK_HOST_2,
      port: parseInt(process.env.LAVALINK_PORT_2 || '2333'),
      password: process.env.LAVALINK_PASSWORD_2 || 'Ariekonur0',
      secure: process.env.LAVALINK_SECURE_2 === 'true',
    });
  }

  return nodes;
}

module.exports = {
  prefix: process.env.PREFIX || '?',
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID || '1507649904456241202',
  guildId: process.env.GUILD_ID || null,

  lavalink: {
    nodes: buildNodes(),
  },

  radio: {
    stations: [
      { name: 'Lofi Girl',       url: 'https://ice6.somafm.com/lush-128-mp3',       emoji: '📻' },
      { name: 'Synthwave Radio', url: 'https://ice6.somafm.com/synphaera-128-mp3',  emoji: '🌆' },
      { name: 'Jazz & Blues',    url: 'https://ice4.somafm.com/jazz24-128-mp3',     emoji: '🎷' },
      { name: 'Chillhop',        url: 'https://ice6.somafm.com/groovesalad-128-mp3', emoji: '🐸' },
      { name: 'Deep Focus',      url: 'https://ice6.somafm.com/dronezone-128-mp3',  emoji: '🧘' },
    ],
  },

  music: {
    defaultVolume: parseInt(process.env.DEFAULT_VOLUME || '80'),
    maxQueueSize: 500,
    searchPlatform: 'ytsearch',
    leaveOnEmptyDelay: 30000,
    leaveOnEndDelay: 30000,
    voiceChannelBitrate: 256000,
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
