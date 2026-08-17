// Lyrics client: coba primary provider (optional) lalu fallback ke Genius
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();
const { sanitizeTitle } = require('./sanitizetitle');

const GENIUS_TOKEN = process.env.GENIUS_TOKEN || null;
if (!GENIUS_TOKEN) {
  console.warn('Warning: GENIUS_TOKEN not set. Genius fallback will not work until set.');
}

// Optional primary provider (try to require lyrics-finder if available)
let lyricsFinder = null;
try {
  // eslint-disable-next-line global-require
  lyricsFinder = require('lyrics-finder');
} catch (e) {
  lyricsFinder = null;
}

/**
 * searchGeniusAPI - gunakan Genius search API untuk mendapatkan url lagu
 * @param {string} query
 * @returns {object|null} { id, title, artist, url, full_title } atau null
 */
async function searchGeniusAPI(query) {
  if (!GENIUS_TOKEN) return null;
  try {
    const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${GENIUS_TOKEN}` },
      timeout: 10000
    });
    const hits = resp.data && resp.data.response && resp.data.response.hits;
    if (!hits || hits.length === 0) return null;
    const song = hits[0].result;
    return {
      id: song.id,
      title: song.title,
      artist: song.primary_artist && song.primary_artist.name,
      url: song.url,
      full_title: song.full_title
    };
  } catch (err) {
    console.warn('Genius API search error:', err.message);
    return null;
  }
}

/**
 * scrapeLyricsFromUrl - ambil lirik dari halaman genius.com (HTML)
 * @param {string} songUrl
 * @returns {string|null} lirik atau null
 */
async function scrapeLyricsFromUrl(songUrl) {
  try {
    const page = await axios.get(songUrl, {
      headers: { 'User-Agent': 'lyrics-bot/1.0 (+https://github.com/)' },
      timeout: 10000
    });
    const $ = cheerio.load(page.data);

    // markup baru Genius: div[data-lyrics-container="true"]
    const parts = [];
    $('div[data-lyrics-container="true"]').each((i, el) => {
      parts.push($(el).text().trim());
    });

    let lyrics = parts.join('\n\n').trim();

    if (!lyrics) {
      // fallback legacy
      const legacy = $('.lyrics').text().trim();
      lyrics = legacy || null;
    }

    if (!lyrics) return null;
    return lyrics.replace(/\r\n/g, '\n').trim();
  } catch (err) {
    console.warn('Error scraping Genius URL:', err.message);
    return null;
  }
}

/**
 * getLyricsFromGenius - orchestrate search + scrape
 * @param {string} query
 * @returns {object|null} { source: 'genius', song, lyrics, queryUsed } or null
 */
async function getLyricsFromGenius(query) {
  const hit = await searchGeniusAPI(query);
  if (!hit) return null;
  const lyrics = await scrapeLyricsFromUrl(hit.url);
  if (!lyrics) return null;
  return { source: 'genius', song: hit, lyrics, queryUsed: query };
}

/**
 * lookupPrimary - panggil provider lokal jika ada (lyrics-finder)
 * @param {string} artist
 * @param {string} title
 * @returns {string|null} lyrics
 */
async function lookupPrimary(artist, title) {
  if (!lyricsFinder) return null;
  try {
    // lyrics-finder accepts (artist, title) or a single query
    const byArtistTitle = await lyricsFinder(artist || '', title || '');
    if (byArtistTitle) return byArtistTitle;
    const single = await lyricsFinder(`${artist ? artist + ' ' : ''}${title || ''}`);
    return single || null;
  } catch (err) {
    console.warn('Primary lyric provider error:', err.message);
    return null;
  }
}

/**
 * getLyrics - Public API: coba primary lalu beberapa variasi Genius
 * @param {object} opts { title, artist, rawTitle }
 * @returns {object|null} { source, lyrics, song?, queryUsed? } atau null
 */
async function getLyrics({ title, artist, rawTitle }) {
  const raw = rawTitle || title || '';
  const cleanTitle = sanitizeTitle(raw);
  const tried = [];

  // 1) try primary provider with artist+title
  try {
    const primaryQueryArtistTitle = artist ? artist : '';
    const primaryLyrics = await lookupPrimary(primaryQueryArtistTitle, cleanTitle || raw);
    if (primaryLyrics) {
      return { source: 'primary', lyrics: primaryLyrics, queryUsed: `${primaryQueryArtistTitle} ${cleanTitle}`.trim() };
    }
  } catch (err) {
    // lanjut ke fallback
  }

  // 2) Genius fallback: beberapa variasi untuk meningkatkan peluang
  const candidateQueries = [];
  if (artist && cleanTitle) candidateQueries.push(`${artist} ${cleanTitle}`);
  if (cleanTitle) candidateQueries.push(cleanTitle);
  if (raw && raw !== cleanTitle) candidateQueries.push(raw);

  for (const q of candidateQueries) {
    tried.push(q);
    const g = await getLyricsFromGenius(q);
    if (g && g.lyrics) {
      return { source: 'genius', lyrics: g.lyrics, song: g.song, queryUsed: q };
    }
  }

  // tidak ditemukan
  return null;
}

module.exports = { getLyrics };
