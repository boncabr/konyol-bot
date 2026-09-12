const logger = require('../utils/logger');

const {
  isRadioMode,
  setAutoplay,
  clearVoiceEmoji,
  setVoiceStatus,
} = require('../music/MusicManager');

const {
  ensureVoiceChannelBitrate,
} = require('../utils/voiceChannelBitrate');

module.exports = {
  name: 'voiceStateUpdate',

  async execute(client, oldState, newState) {
    try {
      const guildId = oldState.guild.id;
      const player = client.lavalink.getPlayer(guildId);

      if (!player) {
        return;
      }

      const botId = client.user.id;

      /*
       * Bot terputus secara paksa dari voice channel.
       */
      if (oldState.id === botId && !newState.channelId) {
        logger.warn(
          `Bot was disconnected from voice in guild ${guildId} ` +
          `— scheduling reconnect`
        );

        /*
         * Reset semua filter EQ/efek ke default sebelum reconnect.
         */
        try {
          const pCheck = client.lavalink.getPlayer(guildId);

          if (pCheck?.filterManager) {
            await pCheck.filterManager.resetFilters();

            logger.info(
              `Filters reset after force-disconnect in guild ${guildId}`
            );
          }
        } catch (resetErr) {
          logger.warn(
            `Filter reset after disconnect failed: ${resetErr.message}`
          );
        }

        /*
         * Matikan autoplay saat bot keluar dari voice channel.
         */
        setAutoplay(guildId, false);

        logger.debug(
          `Autoplay dimatikan karena bot keluar dari VC ` +
          `di guild ${guildId}`
        );

        /*
         * Reset emoji preference saat bot keluar dari voice channel.
         */
        clearVoiceEmoji(guildId);

        /*
         * Hapus voice channel status.
         */
        if (oldState.channelId) {
          await setVoiceStatus(
            client,
            guildId,
            oldState.channelId,
            ''
          ).catch((error) => {
            logger.warn(
              `Failed to clear voice status on disconnect: ` +
              `${error.message}`
            );
          });
        }

        /*
         * Coba reconnect maksimal tiga kali.
         */
        let attempts = 0;

        const tryReconnect = async () => {
          attempts++;

          try {
            const reconnectPlayer =
              client.lavalink.getPlayer(guildId);

            if (!reconnectPlayer) {
              return;
            }

            if (!reconnectPlayer.connected) {
              await reconnectPlayer.connect();

              /*
               * Atur ulang bitrate setelah reconnect berhasil.
               */
              await ensureVoiceChannelBitrate(
                client,
                guildId,
                reconnectPlayer.voiceChannelId ||
                  oldState.channelId
              );

              logger.info(
                `Auto-reconnected to voice in guild ${guildId} ` +
                `(attempt ${attempts})`
              );

              /*
               * Resume playback jika masih ada lagu.
               */
              if (
                !reconnectPlayer.playing &&
                reconnectPlayer.queue.current
              ) {
                try {
                  await reconnectPlayer.play();

                  logger.info(
                    `Resumed playback in guild ${guildId}`
                  );
                } catch (resumeErr) {
                  logger.warn(
                    `Could not resume playback: ` +
                    `${resumeErr.message}`
                  );
                }
              }
            }
          } catch (error) {
            logger.error(
              `Auto-reconnect attempt ${attempts} failed: ` +
              `${error.message}`
            );

            if (attempts < 3) {
              setTimeout(
                tryReconnect,
                attempts * 5000
              );
            } else {
              logger.error(
                `Giving up reconnect after ${attempts} attempts ` +
                `in guild ${guildId}`
              );
            }
          }
        };

        setTimeout(tryReconnect, 3000);

        return;
      }

      /*
       * Bot masuk ke voice channel atau dipindahkan ke channel lain.
       *
       * Kondisi ini juga menangani bot yang baru pertama kali join,
       * karena oldState.channelId biasanya null.
       */
      if (
        oldState.id === botId &&
        newState.channelId &&
        oldState.channelId !== newState.channelId
      ) {
        logger.info(
          `Bot moved to new channel ${newState.channelId} ` +
          `in guild ${guildId}`
        );

        if (
          player.voiceChannelId !== newState.channelId
        ) {
          player.voiceChannelId = newState.channelId;
        }

        /*
         * Atur bitrate otomatis pada channel yang baru dimasuki.
         */
        await ensureVoiceChannelBitrate(
          client,
          guildId,
          newState.channelId
        );

        return;
      }

      /*
       * Jika player tidak memiliki voice channel,
       * tidak ada yang perlu diproses.
       */
      if (!player.voiceChannelId) {
        return;
      }

      const voiceChannel =
        oldState.guild.channels.cache.get(
          player.voiceChannelId
        );

      if (!voiceChannel) {
        return;
      }

      /*
       * Bot tetap berada di voice channel walaupun semua user keluar.
       */
      const members = voiceChannel.members.filter(
        (member) => !member.user.bot
      );

      if (members.size === 0) {
        logger.debug(
          `Voice channel empty in guild ${guildId} ` +
          `— staying as configured (no auto-leave)`
        );

        return;
      }
    } catch (error) {
      logger.error(
        `voiceStateUpdate error: ${error.message}`
      );
    }
  },
};
