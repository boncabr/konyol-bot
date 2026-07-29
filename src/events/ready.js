const { ActivityType } = require('discord.js');
const { registerSlashCommands } = require('../handlers/commandHandler');
const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

    client.user.setPresence({
      activities: [{ name: '?play | /play', type: ActivityType.Listening }],
      status: 'online',
    });

    try {
      await client.lavalink.init({ id: client.user.id, username: client.user.username });
      logger.info('Lavalink manager initialized');
    } catch (err) {
      logger.error(`Lavalink init error: ${err.message} — bot will keep retrying`);
    }

    await registerSlashCommands(client);
  },
};
