'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { checkGuild, formatIssues } = require('../protection/hierarchy');
const { safeEmbed, COLORS } = require('../utils/embed');

const data = new SlashCommandBuilder()
  .setName('health')
  .setDescription('Kiểm tra quyền, thứ bậc role của bot và các lỗi cấu hình')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }); // tải role/thành viên mất hơn 3 giây
  const r = await checkGuild(interaction.guild);
  const errors = r.issues.filter((x) => x.level === 'error').length;
  const warns = r.issues.filter((x) => x.level === 'warn').length;

  const embed = safeEmbed({
    title: r.ok ? '✅ Kiểm tra: không có lỗi nghiêm trọng' : '❌ Kiểm tra: có lỗi cần sửa',
    description: r.issues.length ? formatIssues(r.issues) : 'Mọi thứ đều ổn.',
    color: r.ok ? (warns ? COLORS.warn : COLORS.ok) : COLORS.danger,
    fields: [
      { name: 'Role bot ở trên cùng', value: r.botIsTop ? 'có' : `không (${r.aboveCount} role nằm trên)`, inline: true },
      { name: 'Lỗi / cảnh báo', value: `${errors} / ${warns}`, inline: true },
    ],
    footer: 'Số thành viên mỗi role tính theo cache nên có thể thiếu ở server lớn.',
  });
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute, cooldownSeconds: 15 };
