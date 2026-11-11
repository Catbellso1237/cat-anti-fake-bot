'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getConfig } = require('../config');
const { lockdown, unlock } = require('../protection/raid');
const { sendModLog } = require('../utils/log');
const { COLORS } = require('../utils/embed');
const { relative } = require('../utils/time');

const data = new SlashCommandBuilder()
  .setName('lockdown')
  .setDescription('Khóa hoặc mở khóa chat toàn server khi có raid')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) =>
    s
      .setName('on')
      .setDescription('Khóa gửi tin ở mọi kênh chat')
      .addIntegerOption((o) => o.setName('minutes').setDescription('Tự mở sau (phút)').setMinValue(1).setMaxValue(240)),
  )
  .addSubcommand((s) => s.setName('off').setDescription('Mở khóa và khôi phục quyền cũ'))
  .addSubcommand((s) => s.setName('status').setDescription('Xem trạng thái lockdown'));

async function execute(interaction) {
  const { guild } = interaction;
  const cfg = getConfig(guild.id);
  const sub = interaction.options.getSubcommand();
  const EPH = { flags: MessageFlags.Ephemeral };

  if (sub === 'status') {
    return interaction.reply({
      content: cfg.lockdown ? `Đang khóa ${Object.keys(cfg.lockdown.snapshot).length} kênh, tự mở ${relative(cfg.lockdown.until)}.` : 'Không có lockdown.',
      ...EPH,
    });
  }

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({ content: 'Bot thiếu quyền **Manage Channels**.', ...EPH });
  }

  await interaction.deferReply(EPH); // sửa nhiều kênh mất hơn 3 giây
  if (sub === 'on') {
    const minutes = interaction.options.getInteger('minutes');
    const n = await lockdown(guild, cfg, { durationMs: minutes ? minutes * 60_000 : undefined, reason: `Lockdown thủ công bởi ${interaction.user.tag}` });
    await sendModLog(guild, { title: '🔒 Lockdown thủ công', description: `Khóa ${n} kênh, tự mở ${relative(cfg.lockdown.until)}.`, user: interaction.user, color: COLORS.danger, alert: true });
    return interaction.editReply(`Đã khóa ${n} kênh. Dùng /lockdown off để mở sớm.`);
  }
  if (!cfg.lockdown) return interaction.editReply('Server không ở trạng thái lockdown.');
  const n = await unlock(guild, cfg, `Mở khóa bởi ${interaction.user.tag}`);
  await sendModLog(guild, { title: '🔓 Mở khóa', description: `Khôi phục ${n} kênh.`, user: interaction.user, color: COLORS.ok, alert: true });
  return interaction.editReply(`Đã mở khóa ${n} kênh.`);
}

module.exports = { data, execute, cooldownSeconds: 10 };
