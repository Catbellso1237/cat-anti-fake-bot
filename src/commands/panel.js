'use strict';
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { getConfig } = require('../config');
const { safeEmbed, COLORS } = require('../utils/embed');
const { render } = require('../panel/controlPanel');

const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Bảng điều khiển bảo mật và bảng xác minh')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName('control').setDescription('Mở bảng điều khiển bảo mật (chỉ bạn thấy)'))
  .addSubcommand((s) => s.setName('verify').setDescription('Đăng bảng xác minh (nút cấp role Verified) vào kênh này'));

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'control') {
    return interaction.reply({ ...render(interaction.guild), flags: MessageFlags.Ephemeral });
  }

  // verify
  const cfg = getConfig(interaction.guildId);
  if (!cfg.verifiedRoleId) {
    return interaction.reply({ content: 'Chưa có role xác minh. Chạy /setup trước.', flags: MessageFlags.Ephemeral });
  }
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify').setLabel('Xác minh').setStyle(ButtonStyle.Success),
  );
  await interaction.channel.send({
    embeds: [
      safeEmbed({
        title: 'Xác minh thành viên',
        description: 'Bấm nút bên dưới để vào server. Khi server đang bị raid, xác minh sẽ tạm dừng vài phút.',
        color: COLORS.ok,
      }),
    ],
    components: [row],
  });
  return interaction.reply({ content: 'Đã đăng bảng xác minh.', flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute, cooldownSeconds: 5 };
