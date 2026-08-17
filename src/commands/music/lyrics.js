// Command handler contoh yang memanggil src/utils/lyricsclient.js
// Asumsi: handler menerima (message, args, context)
// Sesuaikan access ke player sesuai struktur project Anda

const { getLyrics } = require('../utils/lyricsclient');

module.exports = {
  name: 'lyrics',
  description: 'Tampilkan lirik lagu yang sedang diputar atau berdasarkan judul',
  async execute(message, args, context = {}) {
    // Ambil track info dari context.player atau gunakan argumen
    const track = (context.player && context.player.currentTrack) || null;
    const rawTitle = (track && (track.title || track.name)) || args.join(' ') || '';
    const artist = (track && (track.author || track.artist)) || '';

    if (!rawTitle) {
      return message.channel.send('Tidak ada judul lagu tersedia. Sebutkan judul atau putar lagu terlebih dahulu.');
    }

    // minta lyricsclient mencari lirik
    const result = await getLyrics({ title: rawTitle, artist, rawTitle });

    if (!result || !result.lyrics) {
      console.log('Lyric search failed for:', { rawTitle, artist });
      return message.channel.send(`Lirik tidak ditemukan untuk **${rawTitle}**. Coba edit judul atau coba lagu lain.`);
    }

    const lyrics = result.lyrics;
    const sourceNote = result.source === 'genius' && result.song
      ? `${result.song.full_title} — Genius`
      : result.source;

    // Kirim lirik (jika panjang, kirim sebagai file .txt)
    try {
      if (lyrics.length <= 1900) {
        return message.channel.send(`Lirik (${sourceNote}) untuk **${rawTitle}**:\n\n${lyrics}`);
      } else {
        const buffer = Buffer.from(lyrics, 'utf8');
        return message.channel.send({
          content: `Lirik (${sourceNote}) untuk **${rawTitle}**: (terlampir sebagai file karena panjang)`,
          files: [{ attachment: buffer, name: `${rawTitle.replace(/[/\\?%*:|"<>]/g, '_')}.txt` }]
        });
      }
    } catch (err) {
      console.warn('Error sending lyrics message:', err.message);
      return message.channel.send('Terjadi kesalahan saat mengirim lirik. Periksa permission atau ukuran pesan.');
    }
  }
};
