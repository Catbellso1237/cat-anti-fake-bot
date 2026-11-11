'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getConfig } = require('../config');
const { safeEmbed, COLORS } = require('../utils/embed');

const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Đăng bảng xác minh (nút cấp role Verified) vào kênh này')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  const cfg = getConfig(interaction.guildId);
  if (!cfg.verifiedRoleId) {
    return interaction.reply({ content: 'Chưa có role xác minh. Chạy /setup trước.', flags: MessageFlags.Ephemeral });
  }
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify').setLabel('Xác minh').setStyle(ButtonStyle.Success),
  );
  await interaction.channel.send({
    embeds: [safeEmbed({ title: 'Xác minh thành viên', description: 'Bấm nút bên dưới để vào server.', color: COLORS.ok })],
    components: [row],
  });
  return interaction.reply({ content: 'Đã đăng bảng xác minh.', flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute, cooldownSeconds: 10 };
