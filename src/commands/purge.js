'use strict';
// Dọn chat khi bị raid: xóa tin theo số lượng/người, xóa tin của raider, hoặc reset hẳn kênh.
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getConfig, saveConfig } = require('../config');
const { purgeUsers, getRaiders } = require('../protection/raid');
const { sendModLog } = require('../utils/log');
const { COLORS } = require('../utils/embed');

const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Dọn chat khi bị raid')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand((s) =>
    s
      .setName('messages')
      .setDescription('Xóa tối đa 100 tin gần nhất trong kênh này')
      .addIntegerOption((o) => o.setName('amount').setDescription('Số tin (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
      .addUserOption((o) => o.setName('user').setDescription('Chỉ xóa tin của người này')),
  )
  .addSubcommand((s) => s.setName('raiders').setDescription('Xóa tin nhắn đã ghi nhận của những người vào trong lúc raid'))
  .addSubcommand((s) =>
    s
      .setName('reset_channel')
      .setDescription('Xóa sạch kênh này bằng cách tạo bản sao mới rồi xóa kênh cũ (không thể hoàn tác)')
      .addBooleanOption((o) => o.setName('confirm').setDescription('Chọn true để xác nhận').setRequired(true)),
  );

async function execute(interaction) {
  const { guild, channel } = interaction;
  const cfg = getConfig(guild.id);
  const sub = interaction.options.getSubcommand();
  const EPH = { flags: MessageFlags.Ephemeral };

  if (sub === 'messages') {
    if (!channel?.isTextBased() || !('bulkDelete' in channel)) return interaction.reply({ content: 'Kênh này không hỗ trợ xóa hàng loạt.', ...EPH });
    await interaction.deferReply(EPH);
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount', true);
    const fetched = await channel.messages.fetch({ limit: 100 });
    const ids = [...fetched.filter((m) => !user || m.author.id === user.id).keys()].slice(0, amount);
    // true = bỏ qua tin quá 14 ngày (Discord không cho xóa hàng loạt)
    const res = ids.length ? await channel.bulkDelete(ids, true) : null;
    await sendModLog(guild, { title: '🧹 Purge', description: `${res?.size ?? 0} tin trong <#${channel.id}>`, user: interaction.user, color: COLORS.info });
    return interaction.editReply(`Đã xóa ${res?.size ?? 0} tin. Tin quá 14 ngày không xóa hàng loạt được.`);
  }

  if (sub === 'raiders') {
    await interaction.deferReply(EPH);
    const ids = getRaiders(guild.id);
    if (!ids.length) return interaction.editReply('Chưa có raider nào được ghi nhận (chỉ có khi bot phát hiện raid).');
    const n = await purgeUsers(guild, ids);
    await sendModLog(guild, { title: '🧹 Xóa tin raider', description: `${n} tin của ${ids.length} tài khoản.`, user: interaction.user, color: COLORS.info });
    return interaction.editReply(`Đã xóa ${n} tin của ${ids.length} tài khoản.`);
  }

  // reset_channel
  if (!interaction.options.getBoolean('confirm', true)) return interaction.reply({ content: 'Đã hủy (confirm = false).', ...EPH });
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: 'Bạn cần quyền **Manage Channels**.', ...EPH });
  if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return interaction.reply({ content: 'Chỉ reset được kênh chat thường.', ...EPH });
  if (channel.id === cfg.logChannelId) return interaction.reply({ content: 'Không reset kênh mod-log.', ...EPH });

  await interaction.deferReply(EPH);
  const clone = await channel.clone({ reason: `Reset kênh bởi ${interaction.user.tag}` });
  await clone.setPosition(channel.position).catch(() => {});
  if (cfg.lockdown && channel.id in cfg.lockdown.snapshot) {
    cfg.lockdown.snapshot[clone.id] = cfg.lockdown.snapshot[channel.id]; // để mở khóa vẫn khôi phục đúng
    delete cfg.lockdown.snapshot[channel.id];
    await saveConfig();
  }
  await channel.delete(`Reset kênh bởi ${interaction.user.tag}`);
  await clone.send('Kênh đã được dọn sạch.').catch(() => {});
  await sendModLog(guild, { title: '♻️ Reset kênh', description: `#${clone.name} đã được tạo lại.`, user: interaction.user, color: COLORS.warn });
  return interaction.editReply(`Đã reset #${clone.name}.`).catch(() => {}); // kênh gốc đã bị xóa nên có thể không sửa được
}

module.exports = { data, execute, cooldownSeconds: 5 };
