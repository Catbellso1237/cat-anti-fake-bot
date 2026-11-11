'use strict';
// Tự dựng nhanh những thứ cần thiết: kênh mod-log riêng tư + role xác minh.
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getConfig, saveConfig } = require('../config');
const { safeEmbed, COLORS } = require('../utils/embed');

const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Tự tạo kênh mod-log và role xác minh')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const { guild } = interaction;
  const me = guild.members.me;
  const need = [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles];
  if (!me || !need.every((p) => me.permissions.has(p))) {
    return interaction.reply({ content: 'Bot cần quyền **Manage Channels** và **Manage Roles** để chạy /setup.', flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const cfg = getConfig(guild.id);
  const done = [];

  const existingLog = cfg.logChannelId ? await guild.channels.fetch(cfg.logChannelId).catch(() => null) : null;
  if (!existingLog) {
    const ch = await guild.channels.create({
      name: 'cat-mod-log',
      type: ChannelType.GuildText,
      reason: 'Cat Anti Fake Bot /setup',
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel] },
      ],
    });
    cfg.logChannelId = ch.id;
    done.push(`Tạo kênh <#${ch.id}> (chỉ admin và bot thấy)`);
  } else {
    done.push(`Giữ kênh log hiện có <#${existingLog.id}>`);
  }

  const existingRole = cfg.verifiedRoleId ? guild.roles.cache.get(cfg.verifiedRoleId) : null;
  if (!existingRole) {
    const role = await guild.roles.create({ name: 'Verified', reason: 'Cat Anti Fake Bot /setup' });
    cfg.verifiedRoleId = role.id;
    done.push(`Tạo role <@&${role.id}>`);
  } else {
    done.push(`Giữ role xác minh hiện có <@&${existingRole.id}>`);
  }

  await saveConfig();
  const embed = safeEmbed({
    title: 'Cat Anti Fake Bot: setup xong',
    description: [
      ...done.map((d) => `• ${d}`),
      '',
      '**Việc tiếp theo**',
      '1. Kéo role của bot **lên trên** các role bot cần quản lý.',
      '2. `/security webhook` để nhận cảnh báo raid qua webhook.',
      '3. `/panel` để đăng nút xác minh.',
      '4. Chạy ở chế độ `log` vài ngày, rồi `/security mode act`.',
    ].join('\n'),
    color: COLORS.ok,
  });
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute, cooldownSeconds: 30 };
