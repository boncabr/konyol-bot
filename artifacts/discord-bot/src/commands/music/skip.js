const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const config = require('../../config/config');
const { fadeOutForTransition } = require('../../music/MusicManager');

async function handleSkip(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;

  const player = client.lavalink.getPlayer(guildId);
  if (!player || (!player.playing && !player.paused)) {
    const embed = errorEmbed('Tidak ada lagu yang sedang diputar.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  const member = ctx.member;
  if (!member.voice?.channelId || member.voice.channelId !== player.voiceChannelId) {
    const embed = errorEmbed('Kamu harus berada di voice channel yang sama dengan bot.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  const current = player.queue.current;

  // Kasus 1: Jika tidak ada lagu lagi di antrean (antrean kosong)
  if (player.queue.tracks.length === 0) {
    try {
      await fadeOutForTransition(player, current);
      await player.stopPlaying(); // Hentikan pemutaran karena antrean habis
    } catch (stopErr) {
      try { await player.queue.utils.cleanUp(); } catch (_) {}
    }
    const embed = successEmbed(
      `Melewati **${current?.info?.title || 'lagu saat ini'}**. Tidak ada lagu berikutnya di antrean.`,
      'â­ Dilewati'
    );
    return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  }

  // Kasus 2: Masih ada lagu di antrean
  try {
    // Fade-out dulu, lalu panggil skip() tepat satu kali.
    // Track berikutnya akan fade-in melalui event trackStart.
    const fadeCompleted = await fadeOutForTransition(player, current);

    // Jika lagu sudah berpindah otomatis saat proses fade berlangsung,
    // jangan panggil skip lagi karena bisa melewati dua lagu.
    if (!fadeCompleted) {
      const embed = successEmbed(
        'Lagu sudah berganti secara otomatis.',
        'â­ Dilewati'
      );

      return isInteraction
        ? ctx.reply({ embeds: [embed] })
        : ctx.reply({ embeds: [embed] });
    }

    await player.skip();
  } catch (err) {
    const embed = errorEmbed(`Gagal melewati lagu: ${err.message}`);
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  const embed = successEmbed(
    `Melewati **${current?.info?.title || 'lagu saat ini'}**.`,
    'â­ Dilewati'
  );
  return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
}

module.exports = {
  name: 'skip',
  description: 'Lewati lagu yang sedang diputar',
  cooldown: config.cooldowns.skip,
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Lewati lagu yang sedang diputar'),

  async execute(client, ctx) {
    await handleSkip(client, ctx);
  },
};
