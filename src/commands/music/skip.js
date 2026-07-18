const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const config = require('../../config/config');

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

  // Guard: if no next track in queue, stop playback instead of throwing RangeError
  if (player.queue.tracks.length === 0) {
    try {
      await player.stopPlaying(false, false);
    } catch (stopErr) {
      try { await player.queue.utils.cleanUp(); } catch (_) {}
    }
    const embed = successEmbed(
      `Melewati **${current?.info?.title || 'lagu saat ini'}**. Tidak ada lagu berikutnya di antrean.`,
      '⏭ Dilewati'
    );
    return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  }

  try {
    await player.skip();
    // player.skip() bisa gagal diam-diam jika state player ambigu (baru ganti lagu,
    // buffer, dll). stopPlaying(false, false) memaksa lagu saat ini berhenti dan
    // maju ke track berikutnya di queue secara andal.
    try {
      await player.skip();
      // Verifikasi benar-benar maju; jika tidak, paksa dengan stopPlaying
      if (player.queue.current === current) {
        await player.stopPlaying(false, false);
      }
    } catch (skipErr) {
      await player.stopPlaying(false, false);
    }
  } catch (err) {
    const embed = errorEmbed(`Gagal melewati lagu: ${err.message}`);
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  const embed = successEmbed(
    `Melewati **${current?.info?.title || 'lagu saat ini'}**.`,
    '⏭ Dilewati'
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

