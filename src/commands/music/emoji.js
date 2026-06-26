const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, createEmbed } = require('../../utils/embeds');
const { setVoiceEmoji, getVoiceEmoji, clearVoiceEmoji, setVoiceStatus, cleanTitle } = require('../../music/MusicManager');
const config = require('../../config/config');
const logger = require('../../utils/logger');

const CUSTOM_EMOJI_REGEX = /^<a?:\w{2,32}:\d{17,20}>$/;
const UNICODE_EMOJI_REGEX = /^\p{Emoji}/u;

async function handleEmoji(client, ctx, args) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;
  const channel = ctx.channel;
  const author = isInteraction ? ctx.user : ctx.author;

  const subArg = isInteraction
    ? ctx.options.getString('action')
    : args[0]?.toLowerCase();

  // Sub-command: reset / hapus
  if (subArg === 'reset' || subArg === 'hapus' || subArg === 'off') {
    clearVoiceEmoji(guildId);
    const player = client.lavalink.getPlayer(guildId);
    if (player?.queue?.current) {
      const track = player.queue.current;
      const vcId = ctx.member?.voice?.channelId
        || player.voiceChannelId
        || player.options?.voiceChannelId;
      if (vcId) {
        const DEFAULT_EMOJI = '<a:BearGuitar:1472513366764290252>';
        const status = `**${DEFAULT_EMOJI}${track.info.title} 𝒃𝒚 ${track.info.author}**`;
        await setVoiceStatus(client, guildId, vcId, status);
      }
    }
    const embed = createEmbed({
      color: config.colors.warning,
      title: '🗑️ Emoji Dihapus',
      description: 'Voice status kembali ke format default:\n`**judul**`',
    });
    return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  }

  // Kirim prompt meminta emoji
  const currentEmoji = getVoiceEmoji(guildId);
  const promptEmbed = createEmbed({
    color: config.colors.info || '#5865F2',
    title: '😀 Custom Emoji Voice Status',
    description:
      'Kirim **emoji** yang ingin kamu tampilkan di depan voice channel status!\n\n' +
      (currentEmoji ? `🎨 Emoji saat ini: ${currentEmoji}\n\n` : '') +
      '⏱️ Kamu punya **30 detik** untuk mengirim emoji.\n' +
      '_(ketik `cancel` untuk batal, `reset` untuk hapus emoji)_',
  });

  let promptMsg;
  if (isInteraction) {
    await ctx.reply({ embeds: [promptEmbed] });
    promptMsg = await ctx.fetchReply();
  } else {
    promptMsg = await ctx.reply({ embeds: [promptEmbed] });
  }

  try {
    const collected = await channel.awaitMessages({
      filter: (m) => m.author.id === author.id,
      max: 1,
      time: 30_000,
      errors: ['time'],
    });

    const response = collected.first();
    const input = response.content.trim();

    // Hapus pesan user supaya chat bersih
    await response.delete().catch(() => {});

    // Cancel
    if (input.toLowerCase() === 'cancel') {
      const cancelEmbed = createEmbed({
        color: config.colors.warning,
        title: '❌ Dibatalkan',
        description: 'Pengaturan emoji dibatalkan.',
      });
      if (isInteraction) {
        return ctx.editReply({ embeds: [cancelEmbed] });
      } else {
        return promptMsg.edit({ embeds: [cancelEmbed] });
      }
    }

    // Reset via chat reply
    if (input.toLowerCase() === 'reset' || input.toLowerCase() === 'hapus') {
      clearVoiceEmoji(guildId);
      const player = client.lavalink.getPlayer(guildId);
      if (player?.queue?.current) {
        const track = player.queue.current;
        const DEFAULT_EMOJI = '<a:BearGuitar:1472513366764290252>';
        const status = `**${DEFAULT_EMOJI}${track.info.title} 𝒃𝒚 ${track.info.author}**`;
        await setVoiceStatus(client, guildId, player.voiceChannelId, status).catch(() => {});
      }
      const resetEmbed = createEmbed({
        color: config.colors.warning,
        title: '🗑️ Emoji Dihapus',
        description: 'Voice status kembali ke format default:\n`**judul**`',
      });
      if (isInteraction) {
        return ctx.editReply({ embeds: [resetEmbed] });
      } else {
        return promptMsg.edit({ embeds: [resetEmbed] });
      }
    }

    // Validasi emoji
    const isCustom = CUSTOM_EMOJI_REGEX.test(input);
    const isUnicode = UNICODE_EMOJI_REGEX.test(input);

    if (!isCustom && !isUnicode) {
      const errEmbed = errorEmbed(
        'Input tidak valid! Kirim **satu emoji** saja.\nContoh: 🎵 🔥 💿 🎧'
      );
      if (isInteraction) {
        return ctx.editReply({ embeds: [errEmbed] });
      } else {
        return promptMsg.edit({ embeds: [errEmbed] });
      }
    }

    // Ambil emoji pertama saja (unicode = karakter pertama, custom = seluruh tag)
    const emoji = isCustom ? input : [...input][0];

    setVoiceEmoji(guildId, emoji);
    logger.info(`Voice emoji set to "${emoji}" in guild ${guildId}`);

    // Update voice status langsung jika lagu sedang diputar
    const player = client.lavalink.getPlayer(guildId);
    let preview = '';
    if (player?.queue?.current) {
      const track = player.queue.current;

      // Ambil voiceChannelId dari member's voice state (lebih reliable dari player.voiceChannelId)
      const member = isInteraction ? ctx.member : ctx.member;
      const vcId = member?.voice?.channelId
        || player.voiceChannelId
        || player.options?.voiceChannelId;

      logger.debug(`emoji setVoiceStatus: vcId=${vcId} guildId=${guildId}`);

      if (vcId) {
        const status = `**${emoji}${track.info.title} 𝒃𝒚 ${track.info.author}**`;
        await setVoiceStatus(client, guildId, vcId, status);
        preview = `\n\n🎵 Voice status: \`${emoji}${track.info.title} 𝒃𝒚 ${track.info.author}\``;
      } else {
        logger.warn(`emoji: cannot find voiceChannelId in guild ${guildId}`);
        preview = `\n\n_(Emoji akan tampil di voice status saat track berikutnya mulai)_`;
      }
    }

    const successMsg = createEmbed({
      color: config.colors.success,
      title: `✅ Emoji ${emoji} Disimpan!`,
      description:
        `Emoji **${emoji}** akan tampil di depan voice channel status.${preview}\n\n` +
        `_(Gunakan \`?emoji reset\` untuk menghapus. Emoji otomatis hilang saat bot keluar VC)_`,
    });
    if (isInteraction) {
      return ctx.editReply({ embeds: [successMsg] });
    } else {
      return promptMsg.edit({ embeds: [successMsg] });
    }
  } catch {
    const timeoutEmbed = createEmbed({
      color: config.colors.warning,
      title: '⏱️ Waktu Habis',
      description: 'Tidak ada emoji yang dikirim dalam 30 detik. Pengaturan dibatalkan.',
    });
    if (isInteraction) {
      await ctx.editReply({ embeds: [timeoutEmbed] }).catch(() => {});
    } else {
      await promptMsg.edit({ embeds: [timeoutEmbed] }).catch(() => {});
    }
  }
}

module.exports = {
  name: 'emoji',
  description: 'Tambahkan emoji kustom di depan voice channel status',
  data: new SlashCommandBuilder()
    .setName('emoji')
    .setDescription('Tambahkan emoji kustom di depan voice channel status')
    .addStringOption((opt) =>
      opt
        .setName('action')
        .setDescription('reset = hapus emoji custom')
        .setRequired(false)
        .addChoices({ name: 'reset — hapus emoji', value: 'reset' })
    ),
  async execute(client, ctx, args) {
    await handleEmoji(client, ctx, args || []);
  },
};
