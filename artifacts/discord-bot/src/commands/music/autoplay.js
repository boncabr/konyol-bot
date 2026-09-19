const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed, createEmbed } = require('../../utils/embeds');
const { setAutoplay, getAutoplay, getCachedTracks, detectGenre } = require('../../music/MusicManager');
const config = require('../../config/config');

async function handleAutoplay(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;

  const current = getAutoplay(guildId);
  const newState = !current;
  setAutoplay(guildId, newState);

  if (!newState) {
    const embed = createEmbed({
      color: config.colors.warning,
      title: '🔄 Autoplay Dimatikan',
      description: 'Bot akan berhenti setelah queue habis.',
    });
    return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  }

  // Autoplay ON — tampilkan info genre/seed
  const cache = getCachedTracks(guildId);
  const player = client.lavalink.getPlayer(guildId);
  const currentTrack = player?.queue?.current;

  const recentTracks = currentTrack
    ? [...cache.slice(-4), currentTrack]
    : cache.slice(-5);
  // detectGenre aman dipanggil — selalu tersedia di MusicManager
  const genre = detectGenre(recentTracks);

  let description = '🎵 Bot akan otomatis menambahkan lagu saat queue habis.\n\n';

  if (genre) {
    description += `🎧 Genre terdeteksi: **${genre}**\nBot akan mencari lagu-lagu **${genre}** yang serupa.`;
  } else if (currentTrack) {
    description += `🎤 Artis: **${currentTrack.info.author}**\nBot akan mencari lagu serupa berdasarkan artis ini.`;
  } else if (cache.length > 0) {
    const lastTrack = cache[cache.length - 1];
    description += `🎤 Berdasarkan: ${lastTrack.info.title} 𝗯𝘆 ${lastTrack.info.author}`;
  } else {
    description += '⚠️ Belum ada riwayat lagu — putar lagu terlebih dahulu agar deteksi genre lebih akurat.';
  }

  const embed = createEmbed({
    color: config.colors.success,
    title: '🔄 Autoplay Diaktifkan',
    description,
    footer: 'Genre dideteksi otomatis dari riwayat lagu yang diputar',
  });

  return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
}

module.exports = {
  name: 'autoplay',
  description: 'Toggle autoplay — otomatis putar lagu sesuai genre terakhir saat queue habis',
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay — otomatis putar lagu sesuai genre terakhir'),
  async execute(client, ctx) {
    await handleAutoplay(client, ctx);
  },
};
