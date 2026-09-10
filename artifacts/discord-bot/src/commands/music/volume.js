const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const config = require('../../config/config');
const { setPlaybackVolume } = require('../../music/MusicManager');

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
    const embed = errorEmbed(`Current volume: **${player.volume}%**\nUse \`?volume <1-150>\` to change it.`);
    return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  }

  if (volumeInput < 1 || volumeInput > 150) {
    const embed = errorEmbed('Volume must be between **1** and **150**.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  await setPlaybackVolume(player, volumeInput);

  const emoji = volumeInput === 0 ? 'ð' : volumeInput < 50 ? 'ð' : volumeInput < 100 ? 'ð' : 'ð';
  const embed = successEmbed(`Volume set to **${volumeInput}%** ${emoji}`, 'ð Volume');
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
      opt.setName('level').setDescription('Volume level (1-150)').setMinValue(1).setMaxValue(150)
    ),
  async execute(client, ctx, args) {
    await handleVolume(client, ctx, args);
  },
};
