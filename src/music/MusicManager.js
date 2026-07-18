const logger = require('../utils/logger');
const config = require('../config/config');

const autoplayMap = new Map();
const musicCacheMap = new Map();
const radioModeMap = new Map();
const radioStationMap = new Map();
const seedMap = new Map();            // { title, author, uri, identifier }
const autoplayHistoryMap = new Map(); // Set<uri> — sudah diputar dalam sesi autoplay
const voiceEmojiMap = new Map();      // guildId → custom emoji string

// ─── Radio Mode ───────────────────────────────────────────────────────────────

function setRadioMode(guildId, enabled) { radioModeMap.set(guildId, enabled); }
function setRadioStation(guildId, name) { radioStationMap.set(guildId, name); }
function getRadioStation(guildId) { return radioStationMap.get(guildId) || null; }
function isRadioMode(guildId) { return radioModeMap.get(guildId) === true; }

// ─── Player Management ───────────────────────────────────────────────────────

async function getOrCreatePlayer(client, guildId, voiceChannelId, textChannelId) {
  const nodes = client.lavalink.nodeManager?.nodes;
  const connectedNodes = nodes ? [...nodes.values()].filter((n) => n.connected) : [];
  if (connectedNodes.length === 0) {
    throw new Error(
      'Server musik sedang tidak tersedia (semua node Lavalink offline). ' +
      'Coba lagi dalam beberapa detik.'
    );
  }

  let player = client.lavalink.getPlayer(guildId);

  if (!player) {
    player = await client.lavalink.createPlayer({
      guildId,
      voiceChannelId,
      textChannelId,
      selfDeaf: true,
      selfMute: false,
      volume: config.music.defaultVolume,
      instaUpdateFiltersFix: false,
    });
  } else {
    // Jika bot sudah terhubung ke voice channel lain, tolak — jangan berpindah
    if (player.connected && voiceChannelId && player.voiceChannelId !== voiceChannelId) {
      throw new Error(
        `Bot sedang digunakan di <#${player.voiceChannelId}>. ` +
        `Tunggu sampai selesai, atau ketik \`?stop\` untuk menghentikannya.`
      );
    }
    if (textChannelId) {
      player.textChannelId = textChannelId;
    }
  }

  if (!player.connected) {
    await player.connect();
  }

  return player;
}

// ─── Search & Play ───────────────────────────────────────────────────────────

// Normalisasi query untuk pencocokan judul (hapus tanda baca, lowercase, squeeze spaces)
function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Skor kemiripan judul terhadap query — mencegah lagu yang salah terpilih
function scoreTrack(track, query) {
  const title = normalizeText(track?.info?.title);
  const author = normalizeText(track?.info?.author);
  const q = normalizeText(query);
  if (!q || !title) return 0;
  let score = 0;
  if (title === q) score += 100;
  if (title.includes(q)) score += 60;
  // Token overlap (kata per kata)
  const qTokens = new Set(q.split(' ').filter(Boolean));
  const tTokens = new Set(title.split(' ').filter(Boolean));
  let overlap = 0;
  for (const t of tTokens) if (qTokens.has(t)) overlap++;
  score += (overlap / Math.max(1, qTokens.size)) * 40;
  if (author && q.includes(author)) score += 10;
  return score;
}

function pickBestTrack(tracks, query) {
  if (!tracks || tracks.length === 0) return null;
  let best = tracks[0];
  let bestScore = scoreTrack(best, query);
  for (let i = 1; i < tracks.length; i++) {
    const s = scoreTrack(tracks[i], query);
    if (s > bestScore) { best = tracks[i]; bestScore = s; }
  }
  return best;
}

async function search(player, query, requester) {
  const isUrl = /^https?:\/\//i.test(query);
  const isSpotify = /open\.spotify\.com/i.test(query);
  const isSoundCloud = /soundcloud\.com/i.test(query);
  const isYoutube = /youtube\.com|youtu\.be/i.test(query);

  // Gunakan ytmsearch (YouTube Music) sebagai default — pencocokan judul/audio
  // jauh lebih akurat daripada ytsearch (YouTube) yang sering salah lagu.
  let source = config.music.searchPlatform || 'ytmsearch';
  if (isSpotify) source = 'spsearch';
  else if (isSoundCloud) source = 'scsearch';
  else if (isYoutube || isUrl) source = undefined;

  let result;
  try {
    result = await player.search({ query, source }, requester);
  } catch (err) {
    logger.warn(`Primary search failed (${source}): ${err.message}. Trying fallback...`);
    const fallbacks = ['ytmsearch', 'ytsearch', 'scsearch'];
    for (const fb of fallbacks) {
      if (fb === source) continue;
      try {
        result = await player.search({ query, source: fb }, requester);
        if (result && result.loadType !== 'error' && result.tracks?.length > 0) break;
      } catch (fallbackErr) {
        logger.warn(`Fallback search [${fb}] failed: ${fallbackErr.message}`);
      }
    }
    if (!result || result.loadType === 'error' || !result.tracks?.length) {
      throw new Error('Tidak ada hasil yang ditemukan. Coba query yang berbeda.');
    }
  }

  // Untuk pencarian non-URL, ganti track pertama dengan track yang paling cocok
  // berdasarkan kemiripan judul — mencegah "judul A, suara B".
  if (result && result.loadType !== 'playlist' && result.tracks?.length > 1 && !isUrl) {
    const best = pickBestTrack(result.tracks, query);
    if (best && best !== result.tracks[0]) {
      logger.debug(`Search: picked best match "${best.info.title}" over "${result.tracks[0].info.title}"`);
      result.tracks[0] = best;
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

// ─── Seed Management ──────────────────────────────────────────────────────────

function setSeed(guildId, track) {
  if (!track?.info) return;
  seedMap.set(guildId, {
    title:      track.info.title,
    author:     track.info.author,
    uri:        track.info.uri,
    identifier: track.info.identifier || null,
  });
  autoplayHistoryMap.set(guildId, new Set([track.info.uri]));
  logger.debug(`Seed set [${guildId}]: "${track.info.title}" (id: ${track.info.identifier})`);
}

function getSeed(guildId) {
  return seedMap.get(guildId) || null;
}

function updateAutoplaySeed(guildId, track) {
  if (!track?.info) return;
  seedMap.set(guildId, {
    title:      track.info.title,
    author:     track.info.author,
    uri:        track.info.uri,
    identifier: track.info.identifier || null,
  });
  if (!autoplayHistoryMap.has(guildId)) autoplayHistoryMap.set(guildId, new Set());
  const hist = autoplayHistoryMap.get(guildId);
  hist.add(track.info.uri);
  if (hist.size > 100) hist.delete(hist.values().next().value);
  logger.debug(`Autoplay seed updated [${guildId}]: "${track.info.title}"`);
}

// ─── Genre Detection ──────────────────────────────────────────────────────────

function detectGenre(tracks) {
  if (!tracks || tracks.length === 0) return null;
  const text = tracks
    .map((t) => `${t.info?.title || ''} ${t.info?.author || ''}`)
    .join(' ')
    .toLowerCase();

  const genres = [
    { name: 'K-Pop',           keywords: ['kpop','k-pop','bts','blackpink','twice','exo','got7','nct','stray kids','ive','aespa','red velvet','shinee','monsta x','seventeen','enhypen','txt','bigbang','mamamoo','(g)i-dle','itzy','newjeans','le sserafim'] },
    { name: 'Pop',             keywords: ['pop','taylor swift','ariana grande','justin bieber','ed sheeran','dua lipa','billie eilish','harry styles','olivia rodrigo','selena gomez','charlie puth','maroon 5','shawn mendes'] },
    { name: 'Hip-Hop / Rap',   keywords: ['rap','hip hop','hiphop','hip-hop','drake','kendrick','j. cole','travis scott','post malone','eminem','lil wayne','lil uzi','kanye','nicki minaj','cardi b','juice wrld','xxxtentacion'] },
    { name: 'Rock',            keywords: ['rock','metal','linkin park','metallica','green day','nirvana','foo fighters','red hot chili','system of a down','ac/dc','queen','guns n roses','bon jovi','avenged sevenfold'] },
    { name: 'R&B / Soul',      keywords: ['r&b','rnb','soul','the weeknd','frank ocean','sza','usher','beyoncé','beyonce','rihanna','alicia keys','john legend','daniel caesar'] },
    { name: 'EDM / Electronic',keywords: ['edm','electronic','house','techno','dubstep','trance','avicii','marshmello','alan walker','dj','tiesto','calvin harris','david guetta','martin garrix','skrillex','deadmau5'] },
    { name: 'Jazz',            keywords: ['jazz','blues','swing','bossa nova','bebop','coltrane','miles davis'] },
    { name: 'Classical',       keywords: ['classical','orchestra','symphony','beethoven','mozart','chopin','bach','handel'] },
    { name: 'Lo-Fi',           keywords: ['lofi','lo-fi','lo fi','chill','study music','relaxing music','cafe music'] },
    { name: 'Indie',           keywords: ['indie','alternative','folk','arctic monkeys','tame impala','vampire weekend'] },
    { name: 'OPM',             keywords: ['opm','filipino','tagalog','kundiman','pamungkas','ben&ben','december avenue','eraserheads','parokya','rivermaya'] },
    { name: 'Dangdut',         keywords: ['dangdut','koplo','rhoma irama','via vallen','nella kharisma','denny caknan','happy asmara'] },
    { name: 'Indonesia Pop',   keywords: ['noah','dewa 19','slank','sheila on 7','peterpan','ungu','armada','raisa','isyana','rizky febian','andmesh','kunto aji','hindia','fourtwnty','tulus','yura yunita','tiara andini','mahalini','nadin amizah'] },
  ];

  let bestMatch = null, bestScore = 0;
  for (const genre of genres) {
    const score = genre.keywords.filter((k) => text.includes(k)).length;
    if (score > bestScore) { bestScore = score; bestMatch = genre.name; }
  }
  return bestScore > 0 ? bestMatch : null;
}

// ─── Track Cache ─────────────────────────────────────────────────────────────

function cacheTrack(guildId, track) {
  if (!musicCacheMap.has(guildId)) musicCacheMap.set(guildId, []);
  const cache = musicCacheMap.get(guildId);
  cache.push(track);
  if (cache.length > 50) cache.shift();
}

function getCachedTracks(guildId) { return musicCacheMap.get(guildId) || []; }

// ─── Autoplay Handler ─────────────────────────────────────────────────────────

const AUTOPLAY_BATCH = 5; // berapa lagu yang ditambahkan setiap kali autoplay

async function handleAutoplay(client, player) {
  if (!getAutoplay(player.guildId)) return;

  // Ambil seed — dari seedMap atau fallback ke cache terakhir
  let seed = getSeed(player.guildId);
  if (!seed) {
    const cache = getCachedTracks(player.guildId);
    if (cache.length === 0) return;
    const last = cache[cache.length - 1];
    seed = {
      title:      last.info.title,
      author:     last.info.author,
      uri:        last.info.uri,
      identifier: last.info.identifier || null,
    };
  }

  const history = autoplayHistoryMap.get(player.guildId) || new Set();
  const requester = { id: client.user.id, username: 'Autoplay', isAutoplay: true };
  let tracksToAdd = [];

  // ── Strategi 1: YouTube Mix / Radio playlist dari video ID ──────────────────
  // YouTube Mix URL: watch?v=ID&list=RDID menghasilkan playlist lagu-lagu serupa
  const ytId = seed.identifier;
  const isYtId = ytId && /^[a-zA-Z0-9_-]{11}$/.test(ytId);

  if (isYtId) {
    const mixUrl = `https://www.youtube.com/watch?v=${ytId}&list=RD${ytId}`;
    try {
      const result = await player.search({ query: mixUrl }, requester);
      if (result?.loadType === 'playlist' && result.tracks?.length > 0) {
        tracksToAdd = result.tracks
          .filter((t) => t.info.uri !== seed.uri && !history.has(t.info.uri))
          .slice(0, AUTOPLAY_BATCH);
        if (tracksToAdd.length > 0) {
          logger.debug(
            `Autoplay: YouTube Mix OK — ${tracksToAdd.length} lagu dari seed "${seed.title}" [${guildId(player)}]`
          );
        }
      }
    } catch (err) {
      logger.warn(`Autoplay YouTube Mix gagal: ${err.message}`);
    }
  }

  // ── Strategi 2: Search ytmsearch mix ─────────────────────────────────────────
  if (tracksToAdd.length === 0 && isYtId) {
    const mixSearchQuery = `${seed.title} ${seed.author} mix`;
    try {
      const result = await player.search({ query: mixSearchQuery, source: 'ytsearch' }, requester);
      if (result?.loadType === 'playlist' && result.tracks?.length > 0) {
        tracksToAdd = result.tracks
          .filter((t) => t.info.uri !== seed.uri && !history.has(t.info.uri))
          .slice(0, AUTOPLAY_BATCH);
      }
    } catch (err) {
      logger.warn(`Autoplay mix search gagal: ${err.message}`);
    }
  }

  // ── Strategi 3: Fallback keyword search — ambil 1 lagu terkait ───────────────
  if (tracksToAdd.length === 0) {
    const query = `${seed.title} ${seed.author}`;
    for (const source of ['ytmsearch', 'ytsearch']) {
      try {
        const result = await player.search({ query, source }, requester);
        if (result?.tracks?.length > 0) {
          const filtered = result.tracks.filter(
            (t) => t.info.uri !== seed.uri && !history.has(t.info.uri)
          );
          const track = filtered[0] || result.tracks.find((t) => t.info.uri !== seed.uri) || result.tracks[0];
          if (track) tracksToAdd = [track];
          if (tracksToAdd.length > 0) break;
        }
      } catch (err) {
        logger.warn(`Autoplay fallback [${source}] gagal: ${err.message}`);
      }
    }
  }

  if (tracksToAdd.length === 0) {
    logger.warn(`Autoplay: tidak ada lagu ditemukan untuk seed "${seed.title}" [${guildId(player)}]`);
    return;
  }

  // Tag semua lagu sebagai autoplay agar lavalinkHandler bisa update seed
  for (const track of tracksToAdd) {
    track.requester = { ...requester };
  }

  await player.queue.add(tracksToAdd);
  if (!player.playing) await player.play();

  logger.info(
    `Autoplay [${guildId(player)}]: +${tracksToAdd.length} lagu — seed "${seed.title}" → "${tracksToAdd[0].info.title}"`
  );
}

function guildId(player) { return player.guildId; }

function setVoiceEmoji(guildId, emoji) { voiceEmojiMap.set(guildId, emoji); }
function getVoiceEmoji(guildId) { return voiceEmojiMap.get(guildId) || null; }
function clearVoiceEmoji(guildId) { voiceEmojiMap.delete(guildId); }

function cleanTitle(title) {
  if (!title) return title;
  let t = title;
  // Hapus prefix "Artis - " (format umum YouTube)
  const dash = t.indexOf(" - ");
  if (dash > 0) t = t.slice(dash + 3);
  // Hapus blok parenthesis umum YouTube
  t = t
    .replace(/\s*\[.*?\]/g, "")
    .replace(/\s*\((?:official|lyric|audio|video|mv|hd)[^)]*\)/gi, "")
    .replace(/\s*\((?:feat|ft).?[^)]*\)/gi, "")
    .replace(/\s*\(\s*\)/g, "")
    .replace(/\s*\([^)]*$/g, "")
    .trim();
  return t || title;
}
module.exports = {
  setRadioMode,
  setRadioStation,
  getRadioStation,
  isRadioMode,
  getOrCreatePlayer,
  search,
  play,
  setVoiceStatus,
  setAutoplay,
  getAutoplay,
  setSeed,
  getSeed,
  updateAutoplaySeed,
  detectGenre,
  cacheTrack,
  getCachedTracks,
  handleAutoplay,
  setVoiceEmoji,
  getVoiceEmoji,
  clearVoiceEmoji,
  cleanTitle,
};

