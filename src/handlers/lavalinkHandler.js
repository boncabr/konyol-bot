const logger = require('../utils/logger');
const { setVoiceStatus, cacheTrack, handleAutoplay, isRadioMode, getRadioStation, getAutoplay, setAutoplay, updateAutoplaySeed, getVoiceEmoji, clearVoiceEmoji, cleanTitle } = require('../music/MusicManager');

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
const PROXY_ERRORS = ['proxy', 'tunnel', '407', 'econnrefused', 'socket hang up', 'ENOTFOUND'];
const TIMEOUT_ERRORS = ['timeout', 'ETIMEDOUT', 'EHOSTUNREACH', 'abort'];
const retryingTracks = new Set();

// Track retry attempts for stuck tracks — max 1 retry per URI before giving up
const stuckRetryMap = new Map();

function classifyError(message) {
  if (!message) return 'unknown';
  const lower = message.toLowerCase();
  if (PROXY_ERRORS.some((e) => lower.includes(e))) return 'proxy';
  if (TIMEOUT_ERRORS.some((e) => lower.includes(e))) return 'timeout';
  if (COPYRIGHT_ERRORS.some((e) => lower.includes(e))) return 'copyright';
  if (YOUTUBE_AUTH_ERRORS.some((e) => lower.includes(e))) return 'auth';
  return 'generic';
}

function getFriendlyErrorMsg(type, title) {
  const name = title ? `**${title}**` : 'Lagu ini';
  switch (type) {
    case 'proxy':
      return `⚠️ ${name} gagal dimuat karena koneksi proxy. Mencoba sumber lain...`;
    case 'timeout':
      return `⏱️ ${name} timeout. Mencoba dari sumber lain...`;
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
        const voiceEmoji = getVoiceEmoji(player.guildId);
        const radioStation = isRadioMode(player.guildId) ? getRadioStation(player.guildId) : null;
        const DEFAULT_EMOJI = '<a:BearGuitar:1472513366764290252>';
        const displayTitle = radioStation ? `📻 Radio: ${radioStation}` : track.info.title;
        const displayAuthor = radioStation ? 'Radio Mode' : track.info.author;
        const status = voiceEmoji
          ? `**${voiceEmoji}${displayTitle} 𝒃𝒚 ${displayAuthor}**`
          : `**${DEFAULT_EMOJI}${displayTitle} 𝒃𝒚 ${displayAuthor}**`;
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
    try {
      const title     = track?.info?.title || 'Unknown';
      const uri       = track?.info?.uri   || '';
      const duration  = track?.info?.duration || 0;
      const retryKey  = `${player.guildId}:${uri}`;
      const retries   = stuckRetryMap.get(retryKey) || 0;

      logger.warn(`Track stuck: "${title}" in guild ${player.guildId} — retry #${retries} — ${Math.round(duration / 60000)}min`);

      const textChannel = client.channels.cache.get(player.textChannelId);

      // ── Helper: paksa maju ke lagu berikutnya, cegah double-skip ─────────────
      const forceAdvance = async () => {
        try {
          if (!player || !player.connected) {
            logger.warn(`forceAdvance: player not connected in guild ${player?.guildId}`);
            return;
          }
          await player.stopPlaying(false, false);
        } catch (skipErr) {
          logger.warn(`forceAdvance failed: ${skipErr.message}`);
        }
      };

      // ── Track panjang (> 20 menit) — langsung lewati tanpa retry ─────────────
      if (duration > 20 * 60 * 1000) {
        logger.warn(`Long track stuck (${Math.round(duration / 60000)}min) — skipping without retry`);
        stuckRetryMap.delete(retryKey);
        if (textChannel) {
          await textChannel.send({
            content: `⏭️ **${title}** dilewati (koneksi stream terputus).`
          }).catch(() => {});
        }
        await forceAdvance();
        return;
      }

      // ── Coba ulang maksimal 1x (hanya untuk track pendek) ────────────────────
      if (retries < 1) {
        stuckRetryMap.set(retryKey, retries + 1);
        setTimeout(() => stuckRetryMap.delete(retryKey), 120000);

        try {
          const author = track.info?.author;
          const query  = author ? `${title} ${author}` : title;
          let freshResult = null;

          // Coba re-load via URI YouTube — tolak jika URI sama (pasti stuck lagi)
          if (/youtube\.com|youtu\.be/i.test(uri)) {
            try {
              const r = await player.search({ query: uri }, track.requester || { id: client.user.id, username: 'Retry' });
              if (r?.tracks?.length && r.tracks[0].info.uri !== uri) {
                freshResult = r;
              }
            } catch (_) {}
          }

          // Fallback: cari dari SoundCloud
          if (!freshResult) {
            const scResult = await player.search(
              { query, source: 'scsearch' },
              track.requester || { id: client.user.id, username: 'Retry' }
            ).catch(() => null);
            if (scResult?.tracks?.length) freshResult = scResult;
          }

          // Fallback terakhir: cari YouTube dengan judul saja
          if (!freshResult) {
            const ytResult = await player.search(
              { query, source: 'ytsearch' },
              track.requester || { id: client.user.id, username: 'Retry' }
            ).catch(() => null);
            if (ytResult?.tracks?.length && ytResult.tracks[0].info.uri !== uri) {
              freshResult = ytResult;
            }
          }

          if (freshResult?.tracks?.length) {
            await player.queue.add(freshResult.tracks[0], 0);
            await forceAdvance();
            if (textChannel) {
              await textChannel.send({
                content: `🔄 **${title}** mengalami gangguan, mencoba dari sumber lain...`
              }).catch(() => {});
            }
            logger.info(`Track stuck retry OK: "${title}" — alternative source queued`);
            return;
          }
        } catch (err) {
          logger.warn(`Stuck retry failed for "${title}": ${err.message}`);
        }
      }

      // ── Retry gagal atau batas tercapai — paksa lewati ───────────────────────
      stuckRetryMap.delete(retryKey);
      logger.warn(`Track stuck — giving up on "${title}", forcing advance`);

      if (textChannel) {
        await textChannel.send({
          content: `⏭️ **${title}** tidak bisa diputar, melewati ke lagu berikutnya.`
        }).catch(() => {});
      }
      await forceAdvance();
    } catch (err) {
      logger.error(`trackStuck handler error: ${err.message}`);
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

      // PENTING: jangan panggil player.skip() di sini.
      // autoSkip:true sudah otomatis advance queue via TrackEndEvent dari Lavalink.
      // Memanggil skip() manual + autoSkip = double-skip → seluruh antrian playlist
      // (misal 25 lagu) habis seketika tanpa ada yang sempat diputar.

      if (errType === 'copyright' || errType === 'proxy' || errType === 'timeout') {
        if (textChannel) await textChannel.send({ content: getFriendlyErrorMsg(errType, track?.info?.title) }).catch(() => {});
        // autoSkip akan maju dengan sendirinya
        return;
      }

      retryingTracks.add(retryKey);
      setTimeout(() => retryingTracks.delete(retryKey), 30000);

      if (errType === 'auth') {
        logger.info(`YouTube auth error for "${track?.info?.title}" — silent fallback`);
      }

      const fallback = await tryFallbackSearch(client, player, track);
      if (fallback) {
        logger.info(`Fallback found for "${track?.info?.title}" via ${fallback.source}`);
        // Sisipkan fallback di posisi 0; autoSkip akan memainkannya sebagai lagu berikutnya
        await player.queue.add(fallback.track, 0);
      } else {
        if (errType === 'auth') {
          if (textChannel) await textChannel.send({ content: `⚠️ Tidak ada versi lain dari **${track?.info?.title}** yang ditemukan. Melewati...` }).catch(() => {});
        } else {
          if (textChannel) await textChannel.send({ content: getFriendlyErrorMsg('generic', track?.info?.title) }).catch(() => {});
        }
        // Tidak ada fallback — autoSkip advance ke lagu berikutnya secara otomatis
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
    // Matikan autoplay saat player di-destroy (bot keluar VC via ?leave, ?stop, atau VC kosong)
    setAutoplay(player.guildId, false);
    // Reset emoji ke default saat bot keluar VC
    clearVoiceEmoji(player.guildId);
  });

  client.lavalink.on('playerCreate', (player) => {
    logger.debug(`Player created in guild ${player.guildId}`);
  });

  logger.info('Lavalink event handlers loaded');
}

module.exports = { loadLavalinkEvents };