const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');
const config = require('../../config/config');

module.exports = {
  name: 'lavalink',
  description: 'Tampilkan status koneksi Lavalink node',
  data: new SlashCommandBuilder()
    .setName('lavalink')
    .setDescription('Tampilkan status koneksi Lavalink node'),

  async execute(client, ctx) {
    const isInteraction = ctx.isChatInputCommand?.();

    const nodes = client.lavalink?.nodeManager?.nodes;
    if (!nodes || nodes.size === 0) {
      const embed = createEmbed({
        color: config.colors.error,
        title: '❌ Lavalink Status',
        description: 'Tidak ada node Lavalink yang dikonfigurasi.',
      });
      return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
    }

    const fields = [];
    let anyConnected = false;

    for (const [, node] of nodes) {
      const connected = node.connected;
      if (connected) anyConnected = true;

      const secure = node.options?.secure ? 'wss' : 'ws';
      const status = connected ? '🟢 Terhubung' : '🔴 Tidak Terhubung';

      let statsText = '';
      if (connected && node.stats) {
        const s = node.stats;
        const memUsed = s.memory?.used ? `${Math.round(s.memory.used / 1024 / 1024)} MB` : '?';
        const cpu = s.cpu?.lavalinkLoad != null ? `${(s.cpu.lavalinkLoad * 100).toFixed(1)}%` : '?';
        const players = s.players ?? '?';
        const playingPlayers = s.playingPlayers ?? '?';
        statsText = `\nMemori: ${memUsed} | CPU: ${cpu} | Players: ${playingPlayers}/${players}`;
      }

      fields.push({
        name: `${status} — \`${node.id}\``,
        value: `**Host:** ${secure}://[hidden]:***${statsText}`,
        inline: false,
      });
    }

    const allPlayers = client.lavalink?.players;
    const playerCount = allPlayers ? [...allPlayers.values()].length : 0;

    const embed = createEmbed({
      color: anyConnected ? config.colors.success : config.colors.error,
      title: `${anyConnected ? '✅' : '❌'} Status Lavalink`,
      description: anyConnected
        ? `Server musik **terhubung**. Bot aktif di **${playerCount}** voice channel.`
        : `⚠️ **Semua node Lavalink terputus!**\n\nBot sedang mencoba reconnect otomatis setiap 5 detik.`,
      fields,
      footer: `Prefix command: ${config.prefix}lavalink | Total node: ${nodes.size}`,
    });

    return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  },
};
