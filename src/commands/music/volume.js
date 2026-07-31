const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const config = require('../../config/config');

async function handleVolume(client, ctx, args) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;

  const player = client.lavalink.getPlayer(guildId);
  if (!player) {
    const embed = errorEmbed('No active music player. Start playing something first.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  const member = ctx.member;
  if (!member.voice?.channelId || member.voice.channelId !== player.voiceChannelId) {
    const embed = errorEmbed('You must be in the same voice channel as the bot.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  const volumeInput = isInteraction ? ctx.options.getInteger('level') : parseInt(args?.[0]);

  if (isNaN(volumeInput)) {
    const qualityNote = player.volume === 100
      ? '✅ Kualitas optimal (volume 100%)'
      : '⚠️ Volume < 100% menurunkan kualitas audio sedikit';
    const embed = errorEmbed(`Volume sekarang: **${player.volume}%**\n${qualityNote}\nGunakan \`?volume <1-100>\` untuk mengubahnya.`);
    return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  }

  if (volumeInput < 1 || volumeInput > 100) {
    const embed = errorEmbed('Volume harus antara **1** dan **100**.\n> Volume 100% = kualitas audio terbaik (tidak ada re-encoding).');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  await player.setVolume(volumeInput);

  const emoji = volumeInput < 30 ? '🔈' : volumeInput < 70 ? '🔉' : '🔊';
  const qualityLine = volumeInput === 100 ? '\n✅ Kualitas audio optimal.' : '';
  const embed = successEmbed(`Volume diset ke **${volumeInput}%** ${emoji}${qualityLine}`, '🔊 Volume');
  return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
}

module.exports = {
  name: 'volume',
  description: 'Set or check the playback volume (1-150)',
  cooldown: config.cooldowns.volume,
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the playback volume')
    .addIntegerOption((opt) =>
      opt.setName('level').setDescription('Volume level (1-100) — 100% = kualitas terbaik').setMinValue(1).setMaxValue(100)
    ),
  async execute(client, ctx, args) {
    await handleVolume(client, ctx, args);
  },
};
