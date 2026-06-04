const { SlashCommandBuilder } = require('discord.js');
const { getOrCreatePlayer } = require('../../music/MusicManager');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

async function handleJoin(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const member = ctx.member;

  if (!member.voice?.channelId) {
    const embed = errorEmbed('You must be in a voice channel.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  try {
    await getOrCreatePlayer(client, ctx.guild.id, member.voice.channelId, ctx.channel.id);
    const embed = successEmbed(`Joined <#${member.voice.channelId}>.`, '🔊 Joined');
    return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  } catch (err) {
    const embed = errorEmbed(`Failed to join: ${err.message}`);
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }
}

module.exports = {
  name: 'join',
  description: 'Join your voice channel',
  data: new SlashCommandBuilder().setName('join').setDescription('Join your voice channel'),
  async execute(client, ctx) {
    await handleJoin(client, ctx);
  },
};
