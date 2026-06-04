const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

async function loadCommands(client) {
  client.commands = new Map();
  client.slashCommands = [];

  const commandsPath = path.join(__dirname, '..', 'commands');
  const categories = fs.readdirSync(commandsPath).filter((f) =>
    fs.statSync(path.join(commandsPath, f)).isDirectory()
  );

  for (const category of categories) {
    const files = fs
      .readdirSync(path.join(commandsPath, category))
      .filter((f) => f.endsWith('.js'));

    for (const file of files) {
      try {
        const command = require(path.join(commandsPath, category, file));
        if (!command.name) {
          logger.warn(`Command file ${file} is missing a name property`);
          continue;
        }
        client.commands.set(command.name, command);
        if (command.data) {
          client.slashCommands.push(command.data.toJSON());
        }
        logger.debug(`Loaded command: ${command.name}`);
      } catch (err) {
        logger.error(`Failed to load command ${file}: ${err.message}`);
      }
    }
  }

  logger.info(`Loaded ${client.commands.size} command(s)`);
}

async function registerSlashCommands(client) {
  if (!config.token || !config.clientId) {
    logger.warn('Missing DISCORD_TOKEN or CLIENT_ID — skipping slash command registration');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    logger.info(`Registering ${client.slashCommands.length} slash command(s)...`);

    if (config.guildId) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
        body: client.slashCommands,
      });
      logger.info(`Slash commands registered to guild ${config.guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(config.clientId), {
        body: client.slashCommands,
      });
      logger.info('Slash commands registered globally (may take up to 1 hour to propagate)');
    }
  } catch (err) {
    logger.error(`Failed to register slash commands: ${err.message}`);
  }
}

module.exports = { loadCommands, registerSlashCommands };
