const { checkCooldown } = require('../utils/cooldown');
const { errorEmbed } = require('../utils/embeds');

const { setAutoplay, getAutoplay } = require('../music/MusicManager');
const config = require('../config/config');
const logger = require('../utils/logger');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    const cooldownMs = command.cooldown ?? config.cooldowns.default;
    const { onCooldown, remaining } = checkCooldown(
      message.author.id,
      commandName,
      cooldownMs
    );

    if (onCooldown) {
      return message.reply({
        embeds: [errorEmbed(`Tunggu **${remaining}s** lagi sebelum menggunakan perintah ini.`)],
      });
    }

    // Matikan autoplay hanya jika user eksplisit memulai pemutaran baru atau menghentikan bot
    const AUTOPLAY_RESET_COMMANDS = ['play', 'stop', 'leave'];
    if (AUTOPLAY_RESET_COMMANDS.includes(commandName) && getAutoplay(message.guild.id)) {
      setAutoplay(message.guild.id, false);
      logger.debug(`Autoplay dimatikan karena command "${commandName}" di guild ${message.guild.id}`);
    }

    try {
      await command.execute(client, message, args);
    } catch (err) {
      logger.error(`Prefix command error [${commandName}]: ${err.stack}`);
    }
  },
};
