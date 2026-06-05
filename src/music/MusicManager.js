const logger = require('../utils/logger');
const config = require('../config/config');

const MAX_VOICE_CHANNELS = 2;

const activeVoiceChannels = new Set();
const autoplayMap = new Map();
const musicCacheMap = new Map();
const radioModeMap = new Map();   // guildId → true/false (radio mode active)


const DEFAULT_EQ_BANDS = [
  { band: 0,  gain: 0.25 },
  { band: 1,  gain: 0.25 },
  { band: 2,  gain: 0.20 },
  { band: 3,  gain: 0.10 },
  { band: 4,  gain: 0.05 },
  { band: 5,  gain: 0.05 },
  { band: 6,  gain: 0.10 },
  { band: 7,  gain: 0.15 },  // Vokal boost
  { band: 8,  gain: 0.15 },  // Vokal boost
  { band: 9,  gain: 0.10 },
  { band: 10, gain: 0.05 },
  { band: 11, gain: 0.00 },
  { band: 12, gain: -0.05 },
  { band: 13, gain: -0.05 },
  { band: 14, gain: -0.05 },
];

// ─── Genre Detection ──────────────────────────────────────────────────────────

const GENRE_PATTERNS = [
  { genre: 'lofi hip hop',         keywords: ['lo-fi', 'lofi', 'lo fi', 'chill beats', 'study beats', 'study music', 'relax beats'] },
  { genre: 'hip hop rap',          keywords: ['hip hop', 'hip-hop', 'rap', 'trap', 'drill', 'freestyle', 'lyric', 'cypher'] },
  { genre: 'r&b soul',             keywords: ['r&b', 'rnb', 'soul', 'neo soul', 'rhythm and blues'] },
  { genre: 'heavy metal',          keywords: ['metal', 'heavy metal', 'death metal', 'thrash', 'black metal', 'metalcore'] },
  { genre: 'rock',                 keywords: ['rock', 'punk', 'grunge', 'alternative rock', 'indie rock'] },
  { genre: 'jazz blues',           keywords: ['jazz', 'blues', 'swing', 'bebop', 'bossa nova'] },
  { genre: 'edm electronic',       keywords: ['edm', 'electronic', 'house', 'techno', 'trance', 'dubstep', 'drum and bass', 'dnb', 'dj ', 'remix'] },
  { genre: 'classical orchestral', keywords: ['classical', 'orchestra', 'symphony', 'concerto', 'sonata', 'beethoven', 'mozart', 'chopin'] },
  { genre: 'country folk',         keywords: ['country', 'folk', 'bluegrass', 'acoustic'] },
  { genre: 'reggae',               keywords: ['reggae', 'reggaeton', 'dancehall', 'ska'] },
  { genre: 'kpop',                 keywords: ['kpop', 'k-pop', 'korean pop', 'bts', 'blackpink', 'twice', 'exo', 'nct', 'stray kids', 'aespa', 'ive', 'itzy'] },
  { genre: 'japanese anime ost',   keywords: ['jpop', 'j-pop', 'japanese', 'anime', 'opening', 'ending', 'ost', 'naruto', 'one piece', 'demon slayer', 'attack on titan'] },
  { genre: 'dangdut koplo',        keywords: ['dangdut', 'koplo', 'campursari', 'jaranan', 'orkes'] },
  { genre: 'pop indonesia',        keywords: ['indonesia', 'melayu', 'malaysia', 'indo pop', 'pop indo'] },
  { genre: 'pop',                  keywords: ['pop', 'chart', 'hits', 'top 40', 'viral'] },
];

function detectGenre(tracks) {
  if (!tracks || tracks.length === 0) return null;
  const combined = tracks
    .map((t) => `${t.info?.title || ''} ${t.info?.author || ''}`)
    .join(' ')
    .toLowerCase();

  for (const { genre, keywords } of GENRE_PATTERNS) {
    if (keywords.some((k) => combined.includes(k))) return genre;
  }
  return null;
}

function buildAutoplayQuery(lastTrack, cache) {
  const recentTracks = [...cache.slice(-4), lastTrack].filter(Boolean);
  const genre = detectGenre(recentTracks);
  const year = new Date().getFullYear();

  if (genre) {
    const styles = [
      `best ${genre} songs playlist`,
      `${genre} mix ${year}`,
      `top ${genre} music`,
      `${genre} hits playlist`,
    ];
    const query = styles[Math.floor(Math.random() * styles.length)];
    logger.debug(`Autoplay genre detected: "${genre}" → query: "${query}"`);
    return { query, genre };
  }

  const artist = lastTrack.info.author || '';
  const styles = [
    `${artist} mix playlist`,
    `best songs like ${lastTrack.info.title}`,
    `${artist} greatest hits`,
    `${artist} popular songs`,
  ];
  const query = styles[Math.floor(Math.random() * styles.length)];
  logger.debug(`Autoplay artist fallback: "${artist}" → query: "${query}"`);
  return { query, genre: null };
}

// ─── Voice Channel Tracking ──────────────────────────────────────────────────

function getActiveChannelCount() { return activeVoiceChannels.size; }
function isVoiceChannelActive(guildId) { return activeVoiceChannels.has(guildId); }

function releaseVoiceChannel(guildId) {
  activeVoiceChannels.delete(guildId);
  radioModeMap.delete(guildId);
  logger.debug(`Released voice slot for guild ${guildId} — active: ${activeVoiceChannels.size}/${MAX_VOICE_CHANNELS}`);
}

// ─── Radio Mode ───────────────────────────────────────────────────────────────

function setRadioMode(guildId, enabled) { radioModeMap.set(guildId, enabled); }
function isRadioMode(guildId) { return radioModeMap.get(guildId) === true; }

// ─── Player Management ───────────────────────────────────────────────────────

async function getOrCreatePlayer(client, guildId, voiceChannelId, textChannelId) {
  const nodes = client.lavalink.nodeManager?.nodes;
  const connectedNodes = nodes ? [...nodes.values()].filter((n) => n.connected) : [];
  if (connectedNodes.length === 0) {
    throw new Error(
      'Server musik sedang tidak tersedia (semua node Lavalink offline). ' +
      'Coba lagi dalam beberapa detik, atau hubungi admin bot.'
    );
  }

  let player = client.lavalink.getPlayer(guildId);

  if (!player) {
    if (activeVoiceChannels.size >= MAX_VOICE_CHANNELS) {
      throw new Error(
        `Bot sudah aktif di **${activeVoiceChannels.size}** voice channel (maksimal ${MAX_VOICE_CHANNELS}). ` +
        `Tunggu hingga salah satu channel selesai, atau gunakan \`?leave\` di server lain.`
      );
    }

    player = await client.lavalink.createPlayer({
      guildId,
      voiceChannelId,
      textChannelId,
      selfDeaf: true,
      selfMute: false,
      volume: config.music.defaultVolume,
      instaUpdateFiltersFix: true,
    });

    activeVoiceChannels.add(guildId);
    logger.info(`Voice slot claimed for guild ${guildId} — active: ${activeVoiceChannels.size}/${MAX_VOICE_CHANNELS}`);

  } else {
    if (voiceChannelId && player.voiceChannelId !== voiceChannelId) {
      player.voiceChannelId = voiceChannelId;
    }
    if (textChannelId) player.textChannelId = textChannelId;
  }

  if (!player.connected) {
    await player.connect();
  }

  try {
    const vc = client.channels.cache.get(voiceChannelId);
    if (vc?.type === 2 && vc.bitrate < config.music.voiceChannelBitrate) {
      await vc.setBitrate(config.music.voiceChannelBitrate);
      logger.debug(`Voice channel bitrate set to 256kbps in guild ${guildId}`);
    }
  } catch (err) {
    logger.debug(`Could not set bitrate: ${err.message}`);
  }

  return player;
}

// ─── Search & Play ───────────────────────────────────────────────────────────

function detectSource(query) {
  const q = query.trim();
  if (/open\.spotify\.com/i.test(q)) return 'spsearch';
  if (/music\.apple\.com/i.test(q)) return 'amsearch';
  if (/soundcloud\.com/i.test(q)) return 'scsearch';
  if (/youtube\.com|youtu\.be/i.test(q)) return undefined;
  if (/^https?:\/\//i.test(q)) return undefined;
  return config.music.searchPlatform;
}

async function search(player, query, requester) {
  const source = detectSource(query);

  let result;
  try {
    result = await player.search({ query, source }, requester);
  } catch (err) {
    logger.warn(`Primary search failed (source: ${source}): ${err.message}. Trying ytsearch fallback...`);
    try {
      result = await player.search({ query, source: 'ytsearch' }, requester);
    } catch (fallbackErr) {
      logger.error(`Fallback search also failed: ${fallbackErr.message}`);
      throw new Error('Tidak ada hasil yang ditemukan. Coba query yang berbeda.');
    }
  }

  return result;
}

async function play(player, tracks) {
  if (!tracks || tracks.length === 0) return;
  await player.queue.add(tracks);
  if (!player.playing && !player.paused) {
    await player.play({ volume: player.volume || config.music.defaultVolume });
  }
}

// ─── Voice Status ─────────────────────────────────────────────────────────────

async function setVoiceStatus(client, guildId, channelId, status) {
  try {
    await client.rest.put(`/channels/${channelId}/voice-status`, {
      body: { status: status || '' },
    });
  } catch (err) {
    logger.debug(`Could not set voice status: ${err.message}`);
  }
}

// ─── Autoplay ─────────────────────────────────────────────────────────────────

function setAutoplay(guildId, enabled) { autoplayMap.set(guildId, enabled); }
function getAutoplay(guildId) { return autoplayMap.get(guildId) || false; }

// ─── Track Cache ─────────────────────────────────────────────────────────────

function cacheTrack(guildId, track) {
  if (!musicCacheMap.has(guildId)) musicCacheMap.set(guildId, []);
  const cache = musicCacheMap.get(guildId);
  cache.push(track);
  if (cache.length > 50) cache.shift();
}

function getCachedTracks(guildId) { return musicCacheMap.get(guildId) || []; }

// ─── Autoplay Handler ─────────────────────────────────────────────────────────

async function handleAutoplay(client, player) {
  if (!getAutoplay(player.guildId)) return;

  const cache = getCachedTracks(player.guildId);
  const lastTrack = player.queue.previous || (cache.length > 0 ? cache[cache.length - 1] : null);
  if (!lastTrack) return;

  const { query, genre } = buildAutoplayQuery(lastTrack, cache);

  try {
    let result = null;
    try {
      result = await player.search(
        { query, source: 'ytmsearch' },
        { id: client.user.id, username: 'Autoplay' }
      );
    } catch (err) {
      logger.warn(`Autoplay ytmsearch failed: ${err.message}, trying ytsearch...`);
      result = await player.search(
        { query, source: 'ytsearch' },
        { id: client.user.id, username: 'Autoplay' }
      );
    }

    if (!result?.tracks?.length) return;

    const playedUris = new Set(cache.map((t) => t.info.uri));
    const fresh = result.tracks.filter((t) => !playedUris.has(t.info.uri));
    const pool = fresh.length > 0 ? fresh : result.tracks;
    const track = pool[Math.floor(Math.random() * Math.min(5, pool.length))];
    if (!track) return;

    await player.queue.add(track);
    await player.play();

    const textChannel = client.channels.cache.get(player.textChannelId);
    if (textChannel) {
      const genreLabel = genre ? ` (genre: **${genre}**)` : '';
      await textChannel.send({
        content: `🔄 Autoplay${genreLabel}: menambahkan **${track.info.title}** oleh **${track.info.author}**`,
      }).catch(() => {});
    }
  } catch (err) {
    logger.error(`Autoplay error in guild ${player.guildId}: ${err.message}`);
  }
}

module.exports = {
  MAX_VOICE_CHANNELS,
  DEFAULT_EQ_BANDS,
  activeVoiceChannels,
  detectGenre,
  detectSource,
  getActiveChannelCount,
  isVoiceChannelActive,
  releaseVoiceChannel,
  setRadioMode,
  isRadioMode,
  getOrCreatePlayer,
  search,
  play,
  setVoiceStatus,
  setAutoplay,
  getAutoplay,
  cacheTrack,
  getCachedTracks,
  handleAutoplay,
};
