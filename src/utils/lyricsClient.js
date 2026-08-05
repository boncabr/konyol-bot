const logger = require('./logger');

/**
 * Ambil lirik lagu yang sedang diputar dari Lavalink plugin java-timed-lyrics.
 * Endpoint: GET /v4/sessions/{sessionId}/players/{guildId}/lyrics
 *
 * @param {import('lavalink-client').Player} player
 * @returns {Promise<Object>} Objek lirik dari plugin
 */
async function fetchLyrics(player) {
  const node = player.node;

  if (!node || !node.connected) {
    throw new Error('Node Lavalink tidak terhubung.');
  }

  const sessionId = node.sessionId;
  if (!sessionId) {
    throw new Error('Session ID Lavalink belum tersedia. Coba lagi sebentar.');
  }

  const { host, port, secure, authorization } = node.options;
  const protocol = secure ? 'https' : 'http';
  const url = `${protocol}://${host}:${port}/v4/sessions/${sessionId}/players/${player.guildId}/lyrics`;

  logger.debug(`[Lyrics] Fetching: ${url}`);

  let res;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: authorization,
      },
    });
  } catch (err) {
    throw new Error(`Gagal menghubungi Lavalink: ${err.message}`);
  }

  if (res.status === 404) {
    throw new LyricsNotFoundError('Lirik tidak ditemukan untuk lagu ini.');
  }

  if (res.status === 501) {
    throw new PluginNotInstalledError(
      'Plugin lirik belum terpasang di server Lavalink. Tambahkan java-lyrics-plugin ke application.yml.'
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Lavalink error ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json();
  return data;
}

class LyricsNotFoundError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'LyricsNotFoundError';
  }
}

class PluginNotInstalledError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'PluginNotInstalledError';
  }
}

module.exports = { fetchLyrics, LyricsNotFoundError, PluginNotInstalledError };
