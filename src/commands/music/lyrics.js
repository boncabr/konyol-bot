const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { errorEmbed, createEmbed } = require('../../utils/embeds');
const { fetchLyrics, LyricsNotFoundError, PluginNotInstalledError } = require('../../utils/lyricsClient');
const config = require('../../config/config');

// Batas karakter per embed (Discord max 4096, ambil margin aman)
const EMBED_CHAR_LIMIT = 3900;

/**
 * Pisahkan baris lirik menjadi beberapa chunk agar muat di embed.
 * Masing-masing chunk tidak melebihi EMBED_CHAR_LIMIT karakter.
 *
 * @param {string[]} lines
 * @returns {string[]} Array berisi string chunk siap pakai
 */
function splitIntoChunks(lines) {
  const chunks = [];
  let current = '';

  for (const line of lines) {
    // +1 untuk newline separator
    if (current.length + line.length + 1 > EMBED_CHAR_LIMIT) {
      if (current) chunks.push(current.trimEnd());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }

  if (current.trim()) chunks.push(current.trimEnd());
  return chunks;
}

/**
 * Format lirik menjadi array teks siap embed.
 * - timed lyrics: setiap baris ditampilkan apa adanya, baris yang sedang
 *   diputar (berdasarkan player.position) di-bold.
 * - text lyrics: dipisah per baris kosong (stanza).
 *
 * @param {Object} data  Response dari plugin
 * @param {number} position  Posisi playback saat ini (ms)
 * @returns {string[]} Array chunk teks
 */
function formatLyrics(data, position) {
  if (data.type === 'timed' && Array.isArray(data.lines)) {
    const lines = data.lines
      .filter((l) => l.line && l.line.trim())
      .map((l) => {
        const isActive =
          position >= l.range.start && position < l.range.end;
        return isActive ? `**${l.line}**` : l.line;
      });

    return splitIntoChunks(lines);
  }

  // text / fallback
  if (data.text) {
    const lines = data.text.split('\n');
    return splitIntoChunks(lines);
  }

  return ['*(lirik tidak tersedia dalam format yang dikenal)*'];
}

async function handleLyrics(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;
  const member = ctx.member;

  // Cek user di voice channel
  if (!member.voice?.channelId) {
    const embed = errorEmbed('Kamu harus masuk ke voice channel terlebih dahulu.');
    return isInteraction
      ? ctx.reply({ embeds: [embed], ephemeral: true })
      : ctx.reply({ embeds: [embed] });
  }

  // Cek ada player aktif
  const player = client.lavalink.getPlayer(guildId);
  if (!player || !player.queue.current) {
    const embed = errorEmbed('Tidak ada lagu yang sedang diputar.');
    return isInteraction
      ? ctx.reply({ embeds: [embed], ephemeral: true })
      : ctx.reply({ embeds: [embed] });
  }

  // Defer agar ada waktu fetch
  if (isInteraction) await ctx.deferReply();

  const track = player.queue.current;
  const trackTitle = track.info?.title || 'Unknown';
  const trackAuthor = track.info?.author || 'Unknown';
  const artworkUrl = track.info?.artworkUrl || null;

  try {
    const data = await fetchLyrics(player);
    const chunks = formatLyrics(data, player.position ?? 0);

    // Maksimum 10 embed per pesan (batas Discord API)
    const usedChunks = chunks.slice(0, 10);

    const embeds = usedChunks.map((chunk, i) => {
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setDescription(chunk);

      // Hanya embed pertama yang punya judul dan thumbnail
      if (i === 0) {
        embed.setTitle(`🎵 Lirik — ${trackTitle}`);
        embed.setFooter({ text: `${trackAuthor}  •  ${data.type === 'timed' ? 'Timed Lyrics' : 'Text Lyrics'}` });
        if (artworkUrl) embed.setThumbnail(artworkUrl);
      }

      return embed;
    });

    return isInteraction
      ? ctx.editReply({ embeds })
      : ctx.reply({ embeds });

  } catch (err) {
    let message;

    if (err instanceof LyricsNotFoundError) {
      message = `Lirik tidak ditemukan untuk **${trackTitle}**.\nCoba lagi dengan lagu yang berbeda.`;
    } else if (err instanceof PluginNotInstalledError) {
      message = 'Plugin lirik belum terpasang di server Lavalink.\nHubungi admin untuk menambahkan `java-lyrics-plugin` ke `application.yml`.';
    } else {
      message = `Gagal mengambil lirik: ${err.message}`;
    }

    const embed = errorEmbed(message);
    return isInteraction
      ? ctx.editReply({ embeds: [embed] }).catch(() => {})
      : ctx.reply({ embeds: [embed] }).catch(() => {});
  }
}

module.exports = {
  name: 'lyrics',
  description: 'Tampilkan lirik lagu yang sedang diputar',
  cooldown: 5000,
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Tampilkan lirik lagu yang sedang diputar'),
  async execute(client, ctx) {
    await handleLyrics(client, ctx);
  },
};
