const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');
const config = require('../../config/config');

async function handleLavalinkStatus(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  if (isInteraction) await ctx.deferReply();

  const manager = client.lavalink;
  if (!manager || !manager.nodeManager) {
    const embed = createEmbed({
      color: config.colors.error,
      title: '❌ Lavalink Manager Error',
      description: 'Lavalink manager tidak tersedia',
    });
    return isInteraction ? ctx.editReply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  }

  const nodes = manager.nodeManager.nodes || new Map();
  
  if (nodes.size === 0) {
    const embed = createEmbed({
      color: config.colors.error,
      title: '❌ No Lavalink Nodes',
      description: 'Tidak ada Lavalink node yang dikonfigurasi!',
    });
    return isInteraction ? ctx.editReply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  }

  // Build node status fields
  const fields = [];
  let totalPlayers = 0;
  
  for (const [nodeId, node] of nodes) {
    const isConnected = node.connected;
    const stats = node.stats || {};
    const players = stats.players || 0;
    const memory = stats.memory || {};
    const cpu = stats.cpu || {};

    totalPlayers += players;

    const nodeStatus = isConnected ? '🟢 Connected' : '🔴 Disconnected';
    const fieldValue = [
      `**Status:** ${nodeStatus}`,
      `**Host:** ${node.options?.host || 'unknown'}:${node.options?.port || '?'}`,
      `**Players:** ${players}`,
      `**Memory:** ${Math.round((memory.used || 0) / 1024 / 1024)} MB / ${Math.round((memory.reservable || 0) / 1024 / 1024)} MB`,
      `**CPU:** ${((cpu.lavalinkLoad || 0) * 100).toFixed(1)}%`,
      `**Ping:** ${node.stats?.ping || '?'}ms`,
    ].join('\n');

    fields.push({
      name: `📡 ${nodeId}`,
      value: fieldValue,
      inline: false,
    });
  }

  const embed = createEmbed({
    color: config.colors.success,
    title: '✅ Status Lavalink',
    description: `Server musik **terhubung**. Bot aktif di **${totalPlayers}** voice channel.`,
    fields: [
      {
        name: '📊 Summary',
        value: `**Total Nodes:** ${nodes.size}\n**Total Players:** ${totalPlayers}`,
        inline: false,
      },
      ...fields,
    ],
    footer: {
      text: `Prefix command: ?lavalink | Total node: ${nodes.size} | Today at ${new Date().toLocaleTimeString('id-ID')}`,
    },
  });

  return isInteraction ? ctx.editReply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
}

module.exports = {
  name: 'lavalink',
  aliases: ['lavalink-status', 'lavastatus'],
  description: 'Tampilkan status semua Lavalink nodes',
  data: new SlashCommandBuilder()
    .setName('lavalink')
    .setDescription('Tampilkan status semua Lavalink nodes'),
  async execute(client, ctx) {
    await handleLavalinkStatus(client, ctx);
  },
};
