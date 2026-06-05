const logger = require('../utils/logger');
const config = require('../config/config');

const autoplayMap = new Map();
const musicCacheMap = new Map();
const radioModeMap = new Map();

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
    if (voiceChannelId && player.voiceChannelId !== voiceChannelId) {
      player.voiceChannelId = voiceChannelId;
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

async function search(player, query, requester) {
  const isUrl = /^https?:\/\//i.test(query);
  const isSpotify = /open\.spotify\.com/i.test(query);
  const isSoundCloud = /soundcloud\.com/i.test(query);
  const isYoutube = /youtube\.com|youtu\.be/i.test(query);

  let source = config.music.searchPlatform;
  if (isSpotify) source = 'spsearch';
  else if (isSoundCloud) source = 'scsearch';
  else if (isYoutube || isUrl) source = undefined;

  let result;
  try {
    result = await player.search({ query, source }, requester);
  } catch (err) {
    logger.warn(`Primary search failed (${source}): ${err.message}. Trying fallback...`);
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

  try {
    const query = `${lastTrack.info.author} ${lastTrack.info.title}`;
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

    if (result?.tracks?.length > 0) {
      const filtered = result.tracks.filter((t) => t.info.uri !== lastTrack.info.uri);
      const pool = filtered.length > 0 ? filtered : result.tracks;
      const track = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
      if (track) {
        await player.queue.add(track);
        await player.play();
        logger.debug(`Autoplay: queued "${track.info.title}" in guild ${player.guildId}`);
      }
    }
  } catch (err) {
    logger.error(`Autoplay error: ${err.message}`);
  }
}

module.exports = {
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
