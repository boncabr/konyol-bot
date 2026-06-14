const logger = require('../utils/logger');
const { setVoiceStatus, cacheTrack, handleAutoplay, isRadioMode, getAutoplay, updateAutoplaySeed } = require('../music/MusicManager');

const BOLD_MAP = {
  a:'𝗮',b:'𝗯',c:'𝗰',d:'𝗱',e:'𝗲',f:'𝗳',g:'𝗴',h:'𝗵',i:'𝗶',j:'𝗷',k:'𝗸',l:'𝗹',m:'𝗺',
  n:'𝗻',o:'𝗼',p:'𝗽',q:'𝗾',r:'𝗿',s:'𝘀',t:'𝘁',u:'𝘂',v:'𝘃',w:'𝘄',x:'𝘅',y:'𝘆',z:'𝘇',
  A:'𝗔',B:'𝗕',C:'𝗖',D:'𝗗',E:'𝗘',F:'𝗙',G:'𝗚',H:'𝗛',I:'𝗜',J:'𝗝',K:'𝗞',L:'𝗟',M:'𝗠',
  N:'𝗡',O:'𝗢',P:'𝗣',Q:'𝗤',R:'𝗥',S:'𝗦',T:'𝗧',U:'𝗨',V:'𝗩',W:'𝗪',X:'𝗫',Y:'𝗬',Z:'𝗭',
  '0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵',
};
function toBold(str) {
  return String(str).split('').map(c => BOLD_MAP[c] || c).join('');
}

const COPYRIGHT_ERRORS = ['copyright', 'not available in your country', 'blocked', 'unavailable', 'private', 'removed'];
const YOUTUBE_AUTH_ERRORS = ['requires login', 'all clients failed', 'video player configuration error', 'sign in to confirm', 'bot traffic', 'age-restricted'];
const retryingTracks = new Set();

// Track retry attempts for stuck tracks — max 1 retry per URI before giving up
const stuckRetryMap = new Map();

function classifyError(message) {
  if (!message) return 'unknown';
  const lower = message.toLowerCase();
  if (COPYRIGHT_ERRORS.some((e) => lower.includes(e))) return 'copyright';
  if (YOUTUBE_AUTH_ERRORS.some((e) => lower.includes(e))) return 'auth';
  return 'generic';
}

function getFriendlyErrorMsg(type, title) {
  const name = title ? `**${title}**` : 'Lagu ini';
  switch (type) {
    case 'copyright':
      return `⚠️ ${name} dibatasi hak cipta atau tidak tersedia di wilayah ini. Coba lagu lain ya!`;
    case 'auth':
      return `⚠️ ${name} membutuhkan verifikasi YouTube. Mencari versi lain...`;
    default:
      return `⚠️ ${name} gagal diputar. Melewati ke lagu berikutnya...`;
  }
}

async function tryFallbackSearch(client, player, track) {
  const title = track?.info?.title;
  const author = track?.info?.author;
  if (!title) return null;

  const query = author ? `${title} ${author}` : title;
  for (const source of ['scsearch', 'ytsearch']) {
    try {
      const result = await player.search({ query, source }, { id: client.user.id, username: 'Fallback' });
      if (result?.tracks?.length > 0) {
        logger.info(`Fallback search [${source}] found: "${result.tracks[0].info.title}"`);
        return { track: result.tracks[0], source };
      }
    } catch (err) {
      logger.warn(`Fallback search [${source}] failed: ${err.message}`);
    }
  }
  return null;
}

async function loadLavalinkEvents(client) {
  client.lavalink.on('trackStart', async (player, track) => {
    try {
      cacheTrack(player.guildId, track);

      if (track.requester?.isAutoplay && getAutoplay(player.guildId)) {
        updateAutoplaySeed(player.guildId, track);
      }

      const voiceChannel = client.channels.cache.get(player.voiceChannelId);
      if (voiceChannel) {
        const status = `${toBold(track.info.title)} 𝗯𝘆 ${toBold(track.info.author)}`;
        await setVoiceStatus(client, player.guildId, player.voiceChannelId, status);
      }

      logger.debug(`Track started: "${track.info.title}" in guild ${player.guildId}`);
    } catch (err) {
      logger.error(`trackStart error: ${err.message}`);
    }
  });

  client.lavalink.on('trackEnd', async (player, track) => {
    try {
      if (player.queue.tracks.length === 0) {
        await setVoiceStatus(client, player.guildId, player.voiceChannelId, '');
      }
      logger.debug(`Track ended: "${track.info.title}" in guild ${player.guildId}`);
    } catch (err) {
      logger.error(`trackEnd error: ${err.message}`);
    }
  });

  client.lavalink.on('trackStuck', async (player, track) => {
    const retryKey = `${player.guildId}:${track?.info?.uri}`;
    const retries = stuckRetryMap.get(retryKey) || 0;

    logger.warn(`Track stuck: "${track.info.title}" in guild ${player.guildId} — retry #${retries}`);

    const textChannel = client.channels.cache.get(player.textChannelId);

    // Coba ulang maksimal 1x dengan mencari URL stream baru
    if (retries < 1) {
      stuckRetryMap.set(retryKey, retries + 1);
      // Hapus retry key setelah 2 menit agar lagu yang sama bisa dicoba lagi nanti
      setTimeout(() => stuckRetryMap.delete(retryKey), 120000);

      try {
        const title = track.info?.title;
        const author = track.info?.author;
        const query = author ? `${title} ${author}` : title;

        // Cari URL stream baru untuk lagu yang sama
        let freshResult = null;

        // Coba YouTube URL langsung jika ada
        if (track.info?.uri && /youtube\.com|youtu\.be/i.test(track.info.uri)) {
          try {
            freshResult = await player.search({ query: track.info.uri }, track.requester || { id: client.user.id, username: 'Retry' });
            if (!freshResult?.tracks?.length) freshResult = null;
          } catch (_) { freshResult = null; }
        }

        // Fallback: search by title+author
        if (!freshResult || !freshResult.tracks?.length) {
          freshResult = await player.search(
            { query, source: 'ytsearch' },
            track.requester || { id: client.user.id, username: 'Retry' }
          );
        }

        if (freshResult?.tracks?.length > 0) {
          const freshTrack = freshResult.tracks[0];
          // Sisipkan lagu baru di depan antrian, lalu skip yang stuck
          await player.queue.add(freshTrack, 0);
          await player.skip();

          if (textChannel) {
            await textChannel.send({
              content: `🔄 **${track.info.title}** mengalami gangguan, mencoba ulang...`
            }).catch(() => {});
          }
          logger.info(`Track stuck retry OK: "${track.info.title}" — fresh stream queued`);
          return;
        }
      } catch (err) {
        logger.warn(`Stuck retry search failed for "${track.info?.title}": ${err.message}`);
      }
    }

    // Retry gagal atau batas retry tercapai — lewati ke lagu berikutnya
    stuckRetryMap.delete(retryKey);
    logger.warn(`Track stuck — giving up on "${track.info.title}", skipping`);

    try {
      if (textChannel) {
        await textChannel.send({
          content: `⚠️ **${track.info.title}** tidak bisa diputar, melewati ke lagu berikutnya.`
        }).catch(() => {});
      }
      if (player.queue.tracks.length > 0) await player.skip();
    } catch (err) {
      logger.error(`trackStuck skip error: ${err.message}`);
    }
  });

  client.lavalink.on('trackError', async (player, track, payload) => {
    const errMsg = payload?.exception?.message || payload?.exception?.cause || 'Unknown error';
    const retryKey = `${player.guildId}:${track?.info?.uri}`;

    logger.error(`Track error: "${track?.info?.title}" — ${errMsg}`);

    if (retryingTracks.has(retryKey)) {
      logger.debug(`Skipping duplicate trackError for "${track?.info?.title}"`);
      return;
    }

    try {
      const errType = classifyError(errMsg);
      const textChannel = client.channels.cache.get(player.textChannelId);

      if (errType === 'copyright') {
        if (textChannel) await textChannel.send({ content: getFriendlyErrorMsg('copyright', track?.info?.title) }).catch(() => {});
        if (player.queue.tracks.length > 0) await player.skip();
        return;
      }

      if (errType === 'auth') {
        retryingTracks.add(retryKey);
        setTimeout(() => retryingTracks.delete(retryKey), 30000);

        logger.info(`YouTube auth error for "${track?.info?.title}" — silent fallback`);
        const fallback = await tryFallbackSearch(client, player, track);

        if (fallback) {
          await player.queue.add(fallback.track, 0);
          if (!player.playing) await player.play();
        } else {
          if (textChannel) await textChannel.send({ content: `⚠️ Tidak ada versi lain dari **${track?.info?.title}** yang ditemukan. Melewati...` }).catch(() => {});
          if (player.queue.tracks.length > 0) await player.skip();
        }
        return;
      }

      // Generic error — coba fallback search sebelum skip
      const fallback = await tryFallbackSearch(client, player, track);
      if (fallback) {
        logger.info(`Generic error fallback found for "${track?.info?.title}" via ${fallback.source}`);
        await player.queue.add(fallback.track, 0);
        if (!player.playing) await player.play();
      } else {
        if (textChannel) await textChannel.send({ content: getFriendlyErrorMsg('generic', track?.info?.title) }).catch(() => {});
        if (player.queue.tracks.length > 0) await player.skip();
      }
    } catch (err) {
      logger.error(`trackError handler error: ${err.message}`);
    }
  });

  client.lavalink.on('queueEnd', async (player, track) => {
    try {
      logger.debug(`Queue ended in guild ${player.guildId}`);
      await handleAutoplay(client, player);

      if (player.queue.tracks.length === 0) {
        await setVoiceStatus(client, player.guildId, player.voiceChannelId, '');
        const channel = client.channels.cache.get(player.textChannelId);
        if (channel) {
          await channel.send({ content: '✅ Queue selesai. Tambah lagu dengan `?play`!' }).catch(() => {});
        }
      }
    } catch (err) {
      logger.error(`queueEnd error: ${err.message}`);
    }
  });

  client.lavalink.on('playerDestroy', (player, reason) => {
    logger.debug(`Player destroyed in guild ${player.guildId}: ${reason || 'unknown'}`);
  });

  client.lavalink.on('playerCreate', (player) => {
    logger.debug(`Player created in guild ${player.guildId}`);
  });

  logger.info('Lavalink event handlers loaded');
}

module.exports = { loadLavalinkEvents };
