'use strict';
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Kiểm tra bot còn sống'),
  cooldownSeconds: 5,
  async execute(interaction) {
    await interaction.reply({ content: `Pong! ${Math.round(interaction.client.ws.ping)}ms` });
  },
};
