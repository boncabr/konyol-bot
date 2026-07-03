const { SlashCommandBuilder } = require('discord.js');
const { getOrCreatePlayer, play, search, setRadioMode, setRadioStation } = require('../../music/MusicManager');
const { successEmbed, errorEmbed, createEmbed } = require('../../utils/embeds');
const config = require('../../config/config');

const STATIONS = config.radio?.stations || [];

function stationListEmbed() {
  const list = STATIONS
    .map((s, i) => `\`${i + 1}.\` ${s.emoji} **${s.name}**`)
    .join('\n');

  return createEmbed({
    color: config.colors.primary,
    title: '📻 Daftar Stasiun Radio',
    description:
      `${list}\n\n` +
      `Gunakan: \`?radio <nomor atau nama>\`\n` +
      `Contoh: \`?radio 1\` atau \`?radio lofi\`\n\n` +
      `> Bot tidak akan keluar dari VC selama radio aktif.\n` +
      `> Ketik \`?stop\` untuk menghentikan radio.`,
  });
}

async function handleRadio(client, ctx, args) {
  const isInteraction = ctx.isChatInputCommand?.();
  const member  = ctx.member;
  const channel = ctx.channel;

  const query = isInteraction
    ? ctx.options.getString('station')
    : args.join(' ').trim();

  if (!query) {
    const embed = stationListEmbed();
    return ctx.reply({ embeds: [embed] });
  }

  if (!member.voice?.channelId) {
    const embed = errorEmbed('Kamu harus masuk ke voice channel terlebih dahulu.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  if (isInteraction) await ctx.deferReply();

  // Match station by number or name (fuzzy)
  const idx = parseInt(query, 10);
  let station = null;
  if (!isNaN(idx) && idx >= 1 && idx <= STATIONS.length) {
    station = STATIONS[idx - 1];
  } else {
    const lower = query.toLowerCase();
    station = STATIONS.find((s) => s.name.toLowerCase().includes(lower));
  }

  if (!station) {
    const embed = errorEmbed(`Stasiun \`${query}\` tidak ditemukan. Ketik \`?radio\` untuk daftar.`);
    return isInteraction ? ctx.editReply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  }

  try {
    const player = await getOrCreatePlayer(
      client,
      ctx.guild.id,
      member.voice.channelId,
      channel.id
    );

    setRadioMode(ctx.guild.id, true);
    setRadioStation(ctx.guild.id, station.name);

    const result = await search(player, station.url, isInteraction ? ctx.user : ctx.author);

    if (!result || result.loadType === 'error' || result.loadType === 'empty' || !result.tracks?.length) {
      setRadioMode(ctx.guild.id, false);
      const embed = errorEmbed(`Gagal memuat stasiun **${station.name}**. Coba lagi nanti.`);
      return isInteraction ? ctx.editReply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
    }

    // Bersihkan queue dengan benar (player.queue.clear() bukan splice)
    if (player.playing || player.paused) {
      await player.stopPlaying(true, false);
    }
    if (player.queue.tracks.length > 0) await player.queue.splice(0, player.queue.tracks.length);

    const track = result.tracks[0];
    await play(player, [track]);

    const embed = createEmbed({
      color: config.colors.success,
      title: `${station.emoji} Radio Aktif: ${station.name}`,
      description:
        `📡 Sedang streaming **${station.name}**\n\n` +
        `> Bot tidak akan keluar dari VC meskipun channel kosong.\n` +
        `> Ketik \`?stop\` untuk menghentikan radio.`,
    });
    if (track?.info?.artworkUrl) embed.setThumbnail(track.info.artworkUrl);

    return isInteraction ? ctx.editReply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  } catch (err) {
    setRadioMode(ctx.guild.id, false);
    const embed = errorEmbed(err.message || 'Gagal memutar radio. Coba lagi nanti.');
    return isInteraction
      ? ctx.editReply({ embeds: [embed] }).catch(() => {})
      : ctx.reply({ embeds: [embed] }).catch(() => {});
  }
}

module.exports = {
  name: 'radio',
  description: 'Putar live stream radio tanpa henti (bot tidak keluar VC)',
  cooldown: 5000,
  data: new SlashCommandBuilder()
    .setName('radio')
    .setDescription('Putar live stream radio tanpa henti')
    .addStringOption((opt) =>
      opt
        .setName('station')
        .setDescription('Nama atau nomor stasiun (kosongkan untuk lihat daftar)')
        .setRequired(false)
    ),
  async execute(client, ctx, args) {
    await handleRadio(client, ctx, args || []);
  },
};
