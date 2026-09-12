const { PermissionFlagsBits } = require('discord.js');
const config = require('../config/config');
const logger = require('./logger');

async function ensureVoiceChannelBitrate(client, guildId, channelId) {
  try {
    if (!guildId || !channelId) {
      return;
    }

    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      logger.warn(
        `[BITRATE] Guild ${guildId} tidak ditemukan di cache`
      );
      return;
    }

    const channel =
      guild.channels.cache.get(channelId) ||
      await guild.channels.fetch(channelId).catch(() => null);

    if (
      !channel ||
      !channel.isVoiceBased?.() ||
      typeof channel.setBitrate !== 'function'
    ) {
      return;
    }

    const requestedBitrate =
      Number(config.music.voiceChannelBitrate) || 384000;

    /*
     * Discord mempunyai batas bitrate berdasarkan level boost server.
     * Jika server mendukung 384 kbps, target menjadi 384000.
     * Jika server hanya mendukung 256 kbps, target menjadi 256000.
     */
    const maximumBitrate =
      typeof guild.maximumBitrate === 'number'
        ? guild.maximumBitrate
        : requestedBitrate;

    const targetBitrate = Math.min(
      requestedBitrate,
      maximumBitrate
    );

    if (!targetBitrate) {
      logger.warn(
        `[BITRATE] Server ${guild.name} tidak memiliki batas bitrate yang valid`
      );
      return;
    }

    /*
     * Jangan melakukan request jika bitrate channel
     * sudah sama atau lebih tinggi.
     */
    if (
      typeof channel.bitrate === 'number' &&
      channel.bitrate >= targetBitrate
    ) {
      return;
    }

    const botMember =
      guild.members.me ||
      await guild.members.fetchMe().catch(() => null);

    if (!botMember) {
      logger.warn(
        `[BITRATE] Member bot tidak ditemukan di guild ${guildId}`
      );
      return;
    }

    const hasManageChannelsPermission = botMember
      .permissionsIn(channel)
      .has(PermissionFlagsBits.ManageChannels);

    if (!hasManageChannelsPermission) {
      logger.warn(
        `[BITRATE] Bot tidak memiliki permission Manage Channels ` +
        `di channel ${channel.name} (${channel.id})`
      );
      return;
    }

    await channel.setBitrate(
      targetBitrate,
      'Menyesuaikan bitrate voice channel secara otomatis'
    );

    logger.info(
      `[BITRATE] Bitrate channel ${channel.name} ` +
      `di guild ${guild.name} diubah menjadi ` +
      `${targetBitrate / 1000} kbps`
    );
  } catch (error) {
    logger.warn(
      `[BITRATE] Gagal mengubah bitrate voice channel: ${error.message}`
    );
  }
}

module.exports = {
  ensureVoiceChannelBitrate,
};
