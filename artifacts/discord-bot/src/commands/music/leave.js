const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { clearVoiceStatus, markIntentionalDisconnect } = require('../../music/MusicManager');

async function handleLeave(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;

  const player = client.lavalink.getPlayer(guildId);
  if (!player) {
    const embed = errorEmbed("I'm not in a voice channel.");
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  const member = ctx.member;
  if (!member.voice?.channelId || member.voice.channelId !== player.voiceChannelId) {
    const embed = errorEmbed('You must be in the same voice channel as the bot.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  // Hapus status sebelum player dihancurkan karena channel ID bisa hilang setelah destroy().
  const channelId = player.voiceChannelId;
  markIntentionalDisconnect(guildId);
  await clearVoiceStatus(client, guildId, channelId);
  await player.destroy();

  const embed = successEmbed(`Left <#${channelId}> and cleared the queue.`, 'ð Left');
  return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
}

module.exports = {
  name: 'leave',
  description: 'Leave the voice channel and clear the queue',
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel and clear the queue'),
  async execute(client, ctx) {
    await handleLeave(client, ctx);
  },
};
