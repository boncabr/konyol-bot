const logger = require('./logger');
const config = require('../config/config');

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

  logger.debug(`[Lyrics] Fetching from Lavalink: ${url}`);

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
    throw new LyricsNotFoundError('Lirik tidak ditemukan di Lavalink.');
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

/**
 * Cari lirik dari Genius API sebagai fallback
 * @param {string} title
 * @param {string} author
 * @returns {Promise<Object>} Objek lirik format Genius
 */
async function fetchGeniusLyrics(title, author) {
  const apiKey = config.lyrics?.geniusApiKey;
  
  if (!apiKey) {
    logger.debug('[Lyrics] Genius API key tidak dikonfigurasi, fallback skip');
    throw new LyricsNotFoundError('Lirik tidak ditemukan.');
  }

  try {
    // Step 1: Cari lagu di Genius
    const query = `${title} ${author}`.trim();
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
    
    logger.debug(`[Lyrics] Searching Genius: ${query}`);
    
    const searchRes = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!searchRes.ok) {
      throw new Error(`Genius search error ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const hits = searchData?.response?.hits || [];

    if (hits.length === 0) {
      throw new LyricsNotFoundError('Lagu tidak ditemukan di Genius.');
    }

    // Ambil hasil pertama
    const songUrl = hits[0].result?.url;
    if (!songUrl) {
      throw new LyricsNotFoundError('URL lagu di Genius tidak ditemukan.');
    }

    logger.debug(`[Lyrics] Found on Genius: ${songUrl}`);

    // Step 2: Scrape lirik dari halaman Genius (simple text extraction)
    const pageRes = await fetch(songUrl);
    if (!pageRes.ok) {
      throw new Error(`Failed to fetch Genius page: ${pageRes.status}`);
    }

    const html = await pageRes.text();

    // Extract lirik dari HTML (simple regex — mencari div dengan data-lyrics-container)
    // Pattern: <div data-lyrics-container="true">...lirik...</div>
    const lyricMatch = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/);
    
    if (!lyricMatch || !lyricMatch[1]) {
      throw new LyricsNotFoundError('Tidak bisa extract lirik dari Genius.');
    }

    let lyricText = lyricMatch[1]
      .replace(/<br>/g, '\n')
      .replace(/<[^>]+>/g, '')  // Hapus semua HTML tag
      .trim();

    // Bersihkan line breaks berlebih
    lyricText = lyricText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .join('\n');

    if (!lyricText) {
      throw new LyricsNotFoundError('Lirik kosong dari Genius.');
    }

    logger.info(`[Lyrics] Successfully fetched from Genius (${lyricText.length} chars)`);

    return {
      type: 'text',
      text: lyricText,
      source: 'genius',
    };

  } catch (err) {
    logger.warn(`[Lyrics] Genius fallback failed: ${err.message}`);
    throw err;
  }
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

module.exports = { 
  fetchLyrics,
  fetchGeniusLyrics,
  LyricsNotFoundError, 
  PluginNotInstalledError 
};
