const logger = require('../utils/logger');
const config = require('../config/config');
const {
  ensureVoiceChannelBitrate,
} = require('../utils/voiceChannelBitrate');
const DEFAULT_EQ = [
  { band:  0, gain:  0.10   }, // 20Hz   — sub bass
  { band:  1, gain:  0.15  }, // 60Hz   — bass
  { band:  2, gain:  0.10   }, // 250Hz  — warm
  { band:  3, gain:  0.00  }, // 500Hz  — presence
  { band:  4, gain:  0.0   }, // 1kHz   — midrange
  { band:  5, gain:  -0.05 }, // 2kHz   — clarity
  { band:  6, gain:  -0.1  }, // 4kHz   — air
  { band:  7, gain:  -0.05 }, // 8kHz   — brilliance
  { band:  8, gain:  0.0   }, // 16kHz  — edge
  { band:  9, gain:  0.0   }, // 25kHz  — extreme treble (usually inaudible)
  { band: 10, gain:  0.03  }, // 2.5kHz — vokal sedikit lebih hadir
  { band: 11, gain:  0.05  }, // 4kHz   — detail instrumen
  { band: 12, gain:  0.05  }, // 6.3kHz — udara, balance treble
  { band: 13, gain:  0.04  }, // 10kHz  — sedikit airy
  { band: 14, gain:  0.00  }, // 16kHz  — netral
];

async function applyDefaultEQ(player) {
  try {
    await player.filterManager.setEqualizer(DEFAULT_EQ);
    logger.debug('[EQ] Default bass-smooth EQ diterapkan.');
  } catch (e) {
    logger.warn('[EQ] Gagal terapkan default EQ: ' + e.message);
  }
}

// ─── Stereo Audio Setup (DEFAULT) ──────────────────────────────────────────────
// Applied to every player on creation — no user interaction needed
async function applyStereoDefault(player) {
  try {
    // Force 2-channel stereo output
    await player.filterManager.setAudioOutput('stereo');
    logger.debug('[STEREO] 2-channel stereo enabled by default');
  } catch (e) {
    logger.warn('[STEREO] Failed to apply stereo: ' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const autoplayMap = new Map();
const musicCacheMap = new Map();
const radioModeMap = new Map();
const radioStationMap = new Map();
const seedMap = new Map();            // { title, author, uri, identifier }
const autoplayHistoryMap = new Map(); // Set<uri> — sudah diputar dalam sesi autoplay
const autoplayGenerationMap = new Map(); // Mencegah hasil autoplay lama masuk kembali
const voiceEmojiMap = new Map();      // guildId → custom emoji string
const stereoStatusMap = new Map();    // guildId → stereo status (always true, but tracked for logging)

// ─── Track Fade / Smooth Transition ─────────────────────────────────────────
//
// Fade dilakukan di sisi volume player Lavalink:
// - Lagu yang hampir selesai fade-out selama 6 detik.
// - Lagu berikutnya fade-in selama 6 detik.
// - Skip manual memakai fade-out yang sama.
// - pendingFadeIn dipertahankan supaya autoplay tetap ikut fade-in.

const fadeStateMap = new Map();

function getFadeDuration() {
  return Math.max(100, Number(config.music.fadeDurationMs) || 6000);
}

function getFadeInterval() {
  return Math.max(25, Number(config.music.fadeIntervalMs) || 100);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTrackKey(track) {
  return (
    track?.info?.identifier ||
    track?.info?.uri ||
    track?.info?.title ||
    null
  );
}

function isCurrentTrack(player, track) {
  const current = player.queue?.current;

  if (!current || !track) return false;
  if (current === track) return true;

  const currentKey = getTrackKey(current);
  const trackKey = getTrackKey(track);

  return Boolean(currentKey && trackKey && currentKey === trackKey);
}

function clearFadeTimer(state) {
  if (state?.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function getTargetVolume(player, state = null) {
  const stateVolume = Number(state?.targetVolume);
  const playerVolume = Number(player.volume);
  const defaultVolume = Number(config.music.defaultVolume) || 80;

  if (Number.isFinite(stateVolume) && stateVolume > 0) {
    return stateVolume;
  }

  if (Number.isFinite(playerVolume) && playerVolume > 0) {
    return playerVolume;
  }

  return defaultVolume;
}

async function rampVolume(player, track, from, to, durationMs) {
  const duration = Math.max(0, Number(durationMs) || 0);
  const interval = getFadeInterval();

  if (duration === 0) {
    if (!isCurrentTrack(player, track)) return false;

    await player.setVolume(Math.max(0, Math.round(to)));
    return true;
  }

  const steps = Math.max(1, Math.ceil(duration / interval));
  const stepDuration = duration / steps;

  for (let step = 1; step <= steps; step++) {
    if (!isCurrentTrack(player, track)) {
      return false;
    }

    const progress = step / steps;
    const volume = from + (to - from) * progress;

    await player.setVolume(Math.max(0, Math.round(volume)));

    if (step < steps) {
      await sleep(stepDuration);
    }
  }

  return true;
}

function startTrackFade(player, track) {
  const guildId = player.guildId;
  const previousState = fadeStateMap.get(guildId);

  if (previousState) {
    clearFadeTimer(previousState);
  }

  const state = {
    track,
    trackKey: getTrackKey(track),
    targetVolume: getTargetVolume(player, previousState),
    timer: null,
    fadePromise: null,
    fadedOut: false,
    pendingFadeIn: Boolean(
      previousState?.pendingFadeIn ||
      previousState?.fadedOut
    ),
  };

  fadeStateMap.set(guildId, state);

  // Fade-in untuk lagu baru. Ini juga berlaku untuk lagu autoplay.
  if (state.pendingFadeIn) {
    state.fadePromise = (async () => {
      if (!isCurrentTrack(player, track)) return false;

      await player.setVolume(0);

      return rampVolume(
        player,
        track,
        0,
        state.targetVolume,
        getFadeDuration()
      );
    })()
      .catch((error) => {
        logger.warn(`[Fade] Gagal fade-in: ${error.message}`);
        return false;
      })
      .finally(() => {
        state.fadePromise = null;
        state.pendingFadeIn = false;
      });
  }

  const trackDuration = Number(track?.info?.length || 0);

  // Live stream/radio biasanya tidak memiliki durasi.
  if (trackDuration <= 0) {
    return;
  }

  // Pantau posisi track. Fade-out dimulai ketika sisa waktu <= 6 detik.
  state.timer = setInterval(() => {
    if (state.fadePromise || state.fadedOut) {
      return;
    }

    if (!isCurrentTrack(player, track)) {
      clearFadeTimer(state);

      if (!state.pendingFadeIn) {
        fadeStateMap.delete(guildId);
      }

      return;
    }

    const position = Number(player.position || 0);
    const remaining = trackDuration - position;

    if (remaining > getFadeDuration() || remaining <= 0) {
      return;
    }

    const fadeDuration = Math.min(
      getFadeDuration(),
      Math.max(100, remaining)
    );

    const fromVolume = Number(player.volume) || state.targetVolume;

    state.fadePromise = rampVolume(
      player,
      track,
      fromVolume,
      0,
      fadeDuration
    )
      .then((success) => {
        if (success) {
          state.fadedOut = true;
          state.pendingFadeIn = true;
        }

        return success;
      })
      .catch((error) => {
        logger.warn(`[Fade] Gagal fade-out otomatis: ${error.message}`);
        return false;
      })
      .finally(() => {
        state.fadePromise = null;
      });
  }, 250);
}

// Dipanggil ketika track selesai sebelum track berikutnya mengirim trackStart.
// Status ini penting untuk queueEnd/autoplay.
function prepareNextTrackFade(player) {
  const guildId = player.guildId;
  let state = fadeStateMap.get(guildId);

  if (!state) {
    state = {
      track: null,
      trackKey: null,
      targetVolume: getTargetVolume(player),
      timer: null,
      fadePromise: null,
      fadedOut: false,
      pendingFadeIn: false,
    };

    fadeStateMap.set(guildId, state);
  }

  state.pendingFadeIn = true;
}

// Dipakai oleh command skip agar skip manual juga smooth.
async function fadeOutForTransition(player, track) {
  const guildId = player.guildId;
  let state = fadeStateMap.get(guildId);

  if (!state || state.trackKey !== getTrackKey(track)) {
    if (state) {
      clearFadeTimer(state);
    }

    state = {
      track,
      trackKey: getTrackKey(track),
      targetVolume: getTargetVolume(player),
      timer: null,
      fadePromise: null,
      fadedOut: false,
      pendingFadeIn: false,
    };

    fadeStateMap.set(guildId, state);
  }

  if (state.fadePromise) {
    await state.fadePromise;
  }

  if (!isCurrentTrack(player, track)) {
    return false;
  }

  if (state.fadedOut) {
    return true;
  }

  clearFadeTimer(state);

  const position = Number(player.position || 0);
  const length = Number(track?.info?.length || 0);
  const remaining = length - position;
  const fadeDuration = remaining > 0
    ? Math.min(getFadeDuration(), remaining)
    : getFadeDuration();
  const fromVolume = Number(player.volume) || state.targetVolume;

  state.fadePromise = rampVolume(
    player,
    track,
    fromVolume,
    0,
    fadeDuration
  )
    .then((success) => {
      if (success) {
        state.fadedOut = true;
        state.pendingFadeIn = true;
      }

      return success;
    })
    .catch((error) => {
      logger.warn(`[Fade] Gagal fade-out saat skip: ${error.message}`);
      return false;
    })
    .finally(() => {
      state.fadePromise = null;
    });

  return state.fadePromise;
}

function setPlaybackVolume(player, volume) {
  const state = fadeStateMap.get(player.guildId);

  if (state) {
    state.targetVolume = volume;
  }

  return player.setVolume(volume);
}

function clearTrackFade(player) {
  const state = fadeStateMap.get(player.guildId);

  if (state) {
    clearFadeTimer(state);
  }

  fadeStateMap.delete(player.guildId);
}

// ─── Radio Mode ───────────────────────────────────────────────────────────────

function setRadioMode(guildId, enabled) { radioModeMap.set(guildId, enabled); }
function setRadioStation(guildId, name) { radioStationMap.set(guildId, name); }
function getRadioStation(guildId) { return radioStationMap.get(guildId) || null; }
function isRadioMode(guildId) { return radioModeMap.get(guildId) === true; }

// ─── Stereo Status (Always TRUE) ──────────────────────────────────────────────
function setStereoStatus(guildId, enabled) { stereoStatusMap.set(guildId, enabled); }
function getStereoStatus(guildId) { return stereoStatusMap.get(guildId) !== false; } // Default TRUE

// ─── Player Management ────────────────────────────────────────────────────────

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
      instaUpdateFiltersFix: true,
    });

    // Apply stereo as DEFAULT on new player creation
    try {
      await applyStereoDefault(player);
      setStereoStatus(guildId, true);
      logger.info(`[STEREO] Stereo audio initialized for guild ${guildId}`);
    } catch (err) {
      logger.warn(`[STEREO] Could not initialize stereo for guild ${guildId}: ${err.message}`);
    }
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

  // Mengatur bitrate setelah bot berhasil masuk ke voice channel.
  await ensureVoiceChannelBitrate(
    client,
    guildId,
    player.voiceChannelId || voiceChannelId
  );

  return player;
}

// ─── Search & Play ────────────────────────────────────────────────────────────

async function search(player, query, requester) {
  const isUrl = /^https?:\/\//i.test(query);
  const isSpotify = /open\.spotify\.com/i.test(query);
  const isSoundCloud = /soundcloud\.com/i.test(query);
  const isYoutube = /youtube\.com|youtu\.be/i.test(query);

  // Untuk URL langsung: tanpa prefix source (Lavalink deteksi otomatis)
  // Untuk platform tertentu: gunakan source yang sesuai
  // Untuk query teks biasa: ytmsearch → ytsearch → scsearch (fallback)
  let source = config.music.searchPlatform; // default: ytmsearch
  if (isSpotify) source = 'spsearch';
  else if (isSoundCloud) source = 'scsearch';
  else if (isYoutube || isUrl) source = undefined;

  let result;
  try {
    result = await player.search({ query, source }, requester);
    logger.debug(`Search [${source ?? 'url'}] "${query}" → ${result?.tracks?.length ?? 0} hasil`);
  } catch (err) {
    logger.warn(`Primary search failed (${source}): ${err.message}. Trying fallback...`);
    result = null;
  }

  // Fallback chain untuk query teks: ytmsearch → ytsearch → scsearch
  if (!result || result.loadType === 'empty' || !result.tracks?.length) {
    const fallbacks = [];
    if (source === 'ytmsearch') fallbacks.push('ytsearch', 'scsearch');
    else if (source === 'ytsearch') fallbacks.push('scsearch');
    else if (source !== 'scsearch') fallbacks.push('scsearch');

    for (const fb of fallbacks) {
      logger.info(`Search kosong untuk [${source}], mencoba fallback [${fb}]...`);
      try {
        result = await player.search({ query, source: fb }, requester);
        if (result?.tracks?.length) {
          logger.debug(`Fallback [${fb}] berhasil: ${result.tracks.length} hasil`);
          break;
        }
      } catch (fallbackErr) {
        logger.warn(`Fallback [${fb}] gagal: ${fallbackErr.message}`);
      }
    }

    if (!result || result.loadType === 'empty' || !result.tracks?.length) {
      throw new Error('Tidak ada hasil yang ditemukan. Coba nama lagu yang berbeda.');
    }
  }

  return result;
}

async function play(player, tracks, options = {}) {
  if (!tracks || tracks.length === 0) return;

  const priority = options.priority === true;

  if (priority) {
    // Jangan bergantung pada player.playing/player.paused.
    // Saat autoplay sedang berpindah track, nilainya bisa false
    // walaupun audio masih terdengar.

    // Hapus lagu autoplay yang masih menunggu,
    // supaya permintaan user menjadi lagu berikutnya.
    for (let i = player.queue.tracks.length - 1; i >= 0; i--) {
      const queuedTrack = player.queue.tracks[i];

      if (queuedTrack?.requester?.isAutoplay) {
        await player.queue.splice(i, 1);
      }
    }

    // Masukkan lagu user ke posisi paling depan antrean.
    await player.queue.add(tracks, 0);
  } else {
    await player.queue.add(tracks);
  }

  if (!player.playing && !player.paused) {
    await player.play({
      volume: player.volume || config.music.defaultVolume,
    });
  }
}

// ─── Voice Status ────────────────────────────────────────────────────────────

const voiceStatusCache = new Map();

const voiceStatusQueue = new Map();

// Menjalankan update status secara berurutan per voice channel.
function enqueueVoiceStatusUpdate(cacheKey, operation) {
  const previous = voiceStatusQueue.get(cacheKey) || Promise.resolve();

  const next = previous
    .catch(() => {})
    .then(operation);

  voiceStatusQueue.set(cacheKey, next);

  return next.finally(() => {
    if (voiceStatusQueue.get(cacheKey) === next) {
      voiceStatusQueue.delete(cacheKey);
    }
  });
}

// Menandai disconnect yang memang diminta melalui command stop/leave.
// Ini mencegah voiceStateUpdate melakukan auto-reconnect.
const intentionalDisconnectMap = new Set();

function markIntentionalDisconnect(guildId) {
  intentionalDisconnectMap.add(guildId);
  setTimeout(() => intentionalDisconnectMap.delete(guildId), 15000);
}

function consumeIntentionalDisconnect(guildId) {
  if (!intentionalDisconnectMap.has(guildId)) return false;
  intentionalDisconnectMap.delete(guildId);
  return true;
}

const latestVoiceStatusMap = new Map();
const voiceStatusWorkerMap = new Map();

function setVoiceStatus(
  client,
  guildId,
  channelId,
  status,
  options = {}
) {
  if (!channelId) return Promise.resolve();

  const nextStatus = status || '';
  const force = options.force === true;
  const cacheKey = `${guildId}:${channelId}`;

  // Selalu timpa status pending dengan status paling baru.
  latestVoiceStatusMap.set(cacheKey, {
    client,
    guildId,
    channelId,
    status: nextStatus,
    force,
  });

  // Jika worker sudah berjalan, worker akan mengambil status terbaru
  // setelah request yang sedang berjalan selesai.
  if (voiceStatusWorkerMap.has(cacheKey)) {
    return voiceStatusWorkerMap.get(cacheKey);
  }

  const worker = (async () => {
    try {
      while (latestVoiceStatusMap.has(cacheKey)) {
        const latest = latestVoiceStatusMap.get(cacheKey);
        latestVoiceStatusMap.delete(cacheKey);

        const {
          client: latestClient,
          channelId: latestChannelId,
          status: latestStatus,
          force: latestForce,
        } = latest;

        // Untuk trackStart gunakan force:true agar cache lokal
        // tidak mencegah pengiriman status baru.
        if (
          !latestForce &&
          voiceStatusCache.get(cacheKey) === latestStatus
        ) {
          continue;
        }

        voiceStatusCache.set(cacheKey, latestStatus);

        logger.info(
          `[VoiceStatus] Mengirim status terbaru guild=${guildId} ` +
          `channel=${latestChannelId}: ${latestStatus}`
        );

        try {
          const response = await latestClient.rest.put(
            `/channels/${latestChannelId}/voice-status`,
            {
              body: {
                status: latestStatus,
              },
            }
          );

          logger.info(
            `[VoiceStatus] Request berhasil channel=${latestChannelId} ` +
            `status=${response?.status || 204}`
          );
        } catch (err) {
          if (voiceStatusCache.get(cacheKey) === latestStatus) {
            voiceStatusCache.delete(cacheKey);
          }

          logger.warn(
            `[VoiceStatus] Gagal channel=${latestChannelId}: ${err.message}`
          );
        }
      }
    } finally {
      voiceStatusWorkerMap.delete(cacheKey);
    }
  })();

  voiceStatusWorkerMap.set(cacheKey, worker);
  return worker;
}

// Hapus status lama lalu tampilkan status lagu baru.
async function replaceVoiceStatus(client, guildId, channelId, status) {
  if (!channelId) return;

  const nextStatus = status || '';
  const cacheKey = `${guildId}:${channelId}`;

  return enqueueVoiceStatusUpdate(cacheKey, async () => {
    voiceStatusCache.delete(cacheKey);

    try {
      await client.rest.put(`/channels/${channelId}/voice-status`, {
        body: { status: '' },
      });
    } catch (err) {
      logger.debug(
        `Could not clear voice status before replacement: ${err.message}`
      );
    }

    if (!nextStatus) return;

    voiceStatusCache.set(cacheKey, nextStatus);

    try {
      await client.rest.put(`/channels/${channelId}/voice-status`, {
        body: { status: nextStatus },
      });
    } catch (err) {
      if (voiceStatusCache.get(cacheKey) === nextStatus) {
        voiceStatusCache.delete(cacheKey);
      }

      logger.debug(
        `Could not set replacement voice status: ${err.message}`
      );
    }
  });
}

// Selalu kirim request kosong ketika player keluar.
async function clearVoiceStatus(client, guildId, channelId) {
  if (!channelId) return;

  const cacheKey = `${guildId}:${channelId}`;

  return enqueueVoiceStatusUpdate(cacheKey, async () => {
    voiceStatusCache.delete(cacheKey);

    try {
      await client.rest.put(`/channels/${channelId}/voice-status`, {
        body: { status: '' },
      });
    } catch (err) {
      logger.debug(`Could not clear voice status: ${err.message}`);
    }
  });
}

function buildVoiceStatus(player, track) {
  if (!track?.info) return '';

  const DEFAULT_EMOJI = '<a:14:1118442091379445821>';
  const voiceEmoji = getVoiceEmoji(player.guildId);

  const radioStation = isRadioMode(player.guildId)
    ? getRadioStation(player.guildId)
    : null;

  const displayTitle = radioStation
    ? `📻 Radio: ${radioStation}`
    : track.info.title;

  const displayAuthor = radioStation
    ? 'Radio Mode'
    : track.info.author;

  return `**${voiceEmoji || DEFAULT_EMOJI}${displayTitle} 𝒃𝒚 ${displayAuthor}**`;
}

// ─── Autoplay ─────────────────────────────────────────────────────────────────

function setAutoplay(guildId, enabled) { autoplayMap.set(guildId, enabled); }
function getAutoplay(guildId) { return autoplayMap.get(guildId) || false; }

// ─── Seed Management ──────────────────────────────────────────────────────────

function setSeed(guildId, track) {
  if (!track?.info) return;

  // Membatalkan hasil pencarian autoplay lama yang masih berjalan.
  autoplayGenerationMap.set(
    guildId,
    (autoplayGenerationMap.get(guildId) || 0) + 1
  );

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

  autoplayGenerationMap.set(
    guildId,
    (autoplayGenerationMap.get(guildId) || 0) + 1
  );

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

// ─── Track Cache ──────────────────────────────────────────────────────────────

function cacheTrack(guildId, track) {
  if (!musicCacheMap.has(guildId)) musicCacheMap.set(guildId, []);
  const cache = musicCacheMap.get(guildId);
  cache.push(track);
  if (cache.length > 50) cache.shift();
}

function getCachedTracks(guildId) { return musicCacheMap.get(guildId) || []; }

// ─── Autoplay Handler ─────────────────────────────────────────────────────────

const AUTOPLAY_BATCH = 5; // berapa lagu yang ditambahkan setiap kali autoplay

async function fillAutoplayQueue(client, player) {
  if (!getAutoplay(player.guildId)) return;

  // Simpan generasi saat pencarian dimulai. Jika user meminta lagu baru
  // sebelum pencarian selesai, hasil pencarian lama tidak boleh ditambahkan.
  const generation = autoplayGenerationMap.get(player.guildId) || 0;

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
      const result = await player.search({ query: mixSearchQuery, source: 'ytmsearch' }, requester);
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
    for (const source of ['ytmsearch', 'scsearch']) {
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

  if (
    !getAutoplay(player.guildId) ||
    autoplayGenerationMap.get(player.guildId) !== generation
  ) {
    logger.info(
      `Autoplay [${guildId(player)}]: hasil lama dibatalkan karena ada permintaan lagu baru`
    );
    return;
  }

  await player.queue.add(tracksToAdd);

  if (!player.playing && !player.paused) {
    await player.play();
  }

  logger.info(
    `Autoplay [${guildId(player)}]: +${tracksToAdd.length} lagu — seed "${seed.title}" → "${tracksToAdd[0].info.title}"`
  );
}

const autoplayInFlightMap = new Set();

async function handleAutoplay(client, player) {
  const guildId = player?.guildId;
  if (!guildId || !getAutoplay(guildId)) return;

  // Cegah trackStart dan queueEnd menjalankan pencarian autoplay bersamaan
  if (autoplayInFlightMap.has(guildId)) return;
  autoplayInFlightMap.add(guildId);

  try {
    return await fillAutoplayQueue(client, player);
  } finally {
    autoplayInFlightMap.delete(guildId);
  }
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
    .replace(/\s*\([^)]*\)$/g, "")
    .trim();
  return t || title;
}
module.exports = {
  DEFAULT_EQ,
  setRadioMode,
  setRadioStation,
  getRadioStation,
  isRadioMode,
  getOrCreatePlayer,
  search,
  play,
  startTrackFade,
  prepareNextTrackFade,
  fadeOutForTransition,
  setPlaybackVolume,
  clearTrackFade,
  setVoiceStatus,
  replaceVoiceStatus,
  clearVoiceStatus,
  markIntentionalDisconnect,
  consumeIntentionalDisconnect,
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
  setStereoStatus,
  getStereoStatus,
  applyStereoDefault,
  cleanTitle,
};
