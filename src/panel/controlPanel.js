'use strict';
// Bảng điều khiển bảo mật: một tin nhắn riêng tư (ephemeral) với nút và select menu.
// customId cố định (tiền tố "panel:") nên không dùng collector, mỗi lần bấm đọc lại cấu hình mới nhất.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { getConfig, saveConfig } = require('../config');
const { safeEmbed, COLORS } = require('../utils/embed');
const { relative } = require('../utils/time');
const { maskWebhook, sendWebhook } = require('../utils/webhook');
const { sendModLog } = require('../utils/log');
const { isRaidActive, getRaiders, purgeUsers, lockdown, unlock, isBusy } = require('../protection/raid');
const { checkGuild, healthEmbed } = require('../protection/hierarchy');
const { PRESETS, presetOf, describe } = require('./presets');

const PREFIX = 'panel:';
const EPH = MessageFlags.Ephemeral;
const onOff = (b) => (b ? 'bật' : 'tắt');

function render(guild) {
  const cfg = getConfig(guild.id);
  const raiding = isRaidActive(guild.id);
  const locked = Boolean(cfg.lockdown);
  const preset = presetOf(cfg.raid);

  const embed = safeEmbed({
    title: '🛡️ Bảng điều khiển Cat Anti Fake Bot',
    description:
      cfg.mode === 'act'
        ? 'Chế độ **act**: bot xử lý thật (timeout, kick, khóa kênh, hoàn tác quyền).'
        : 'Chế độ **log**: bot chỉ ghi log, chưa xử lý. Bật act khi đã kiểm tra mod-log.',
    color: raiding ? COLORS.danger : cfg.mode === 'act' ? COLORS.warn : COLORS.info,
    fields: [
      { name: 'Raid', value: raiding ? '🚨 đang raid' : 'không', inline: true },
      { name: 'Lockdown', value: locked ? `🔒 ${Object.keys(cfg.lockdown.snapshot).length} kênh, mở ${relative(cfg.lockdown.until)}` : 'không', inline: true },
      { name: 'Ngưỡng raid', value: `${describe(cfg.raid)}${preset ? ` (mức ${PRESETS[preset].label})` : ' (tùy chỉnh)'}`, inline: true },
      { name: 'Tự khóa khi raid', value: onOff(cfg.raid.autoLockdown), inline: true },
      { name: 'Xóa tin raider', value: onOff(cfg.raid.purgeRaiders), inline: true },
      { name: 'Chống leo thang quyền', value: onOff(cfg.escalation.enabled), inline: true },
      { name: 'Kênh log', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : '(chưa đặt, dùng /setup)', inline: true },
      { name: 'Webhook', value: maskWebhook(cfg.webhookUrl || process.env.RAID_WEBHOOK_URL), inline: true },
      { name: 'Tin cậy', value: `${cfg.trustedUserIds.length} người, ${cfg.trustedBotIds.length} bot`, inline: true },
    ],
    footer: 'Chỉ bạn thấy bảng này. Bấm "Làm mới" để cập nhật số liệu.',
  });

  const btn = (id, label, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(PREFIX + id).setLabel(label).setStyle(style);

  const rows = [
    new ActionRowBuilder().addComponents(
      btn('mode', `Chế độ: ${cfg.mode}`, cfg.mode === 'act' ? ButtonStyle.Danger : ButtonStyle.Secondary),
      btn('lockdown', locked ? 'Mở khóa chat' : 'Khóa chat', locked ? ButtonStyle.Success : ButtonStyle.Danger),
      btn('autolock', `Tự khóa: ${onOff(cfg.raid.autoLockdown)}`, cfg.raid.autoLockdown ? ButtonStyle.Success : ButtonStyle.Secondary),
      btn('escalation', `Chống leo thang: ${onOff(cfg.escalation.enabled)}`, cfg.escalation.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      btn('health', 'Kiểm tra quyền', ButtonStyle.Primary),
      btn('webhook', 'Thử webhook'),
      btn('purge', 'Xóa tin raider'),
      btn('refresh', 'Làm mới'),
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${PREFIX}sens`)
        .setPlaceholder('Mức nhạy phát hiện raid')
        .addOptions(
          Object.entries(PRESETS).map(([value, p]) => ({
            label: p.label,
            value,
            description: describe(p),
            default: value === preset,
          })),
        ),
    ),
  ];
  return { embeds: [embed], components: rows };
}

const isPanelId = (id) => typeof id === 'string' && id.startsWith(PREFIX);

async function handle(interaction) {
  const { guild } = interaction;
  const reply = (content) => interaction.reply({ content, flags: EPH });

  // Kiểm tra quyền ở phía server mỗi lần bấm, không chỉ dựa vào việc tin nhắn là riêng tư.
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return reply('Bạn cần quyền **Manage Server** để dùng bảng điều khiển.');
  }
  const cfg = getConfig(guild.id);
  const action = interaction.customId.slice(PREFIX.length);

  if (action === 'sens') {
    const preset = PRESETS[interaction.values[0]];
    if (!preset) return reply('Mức nhạy không hợp lệ.');
    cfg.raid.maxJoins = preset.maxJoins;
    cfg.raid.windowMs = preset.windowMs;
    await saveConfig();
    return interaction.update(render(guild));
  }

  switch (action) {
    case 'mode':
      cfg.mode = cfg.mode === 'act' ? 'log' : 'act';
      await saveConfig();
      return interaction.update(render(guild));
    case 'autolock':
      cfg.raid.autoLockdown = !cfg.raid.autoLockdown;
      await saveConfig();
      return interaction.update(render(guild));
    case 'escalation':
      cfg.escalation.enabled = !cfg.escalation.enabled;
      await saveConfig();
      return interaction.update(render(guild));
    case 'refresh':
      return interaction.update(render(guild));

    case 'lockdown': {
      if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) return reply('Bot thiếu quyền **Manage Channels**.');
      if (isBusy(guild.id)) return reply('Đang khóa/mở khóa, đợi vài giây rồi bấm "Làm mới".');
      await interaction.deferUpdate(); // sửa nhiều kênh mất hơn 3 giây
      if (cfg.lockdown) {
        const n = await unlock(guild, cfg, `Mở khóa bởi ${interaction.user.tag} (panel)`);
        await sendModLog(guild, { title: '🔓 Mở khóa', description: `Khôi phục ${n} kênh (từ bảng điều khiển).`, user: interaction.user, color: COLORS.ok, alert: true });
      } else {
        const n = await lockdown(guild, cfg, { reason: `Lockdown bởi ${interaction.user.tag} (panel)` });
        await sendModLog(guild, { title: '🔒 Lockdown thủ công', description: `Khóa ${n} kênh (từ bảng điều khiển).`, user: interaction.user, color: COLORS.danger, alert: true });
      }
      return interaction.editReply(render(guild));
    }

    case 'health': {
      await interaction.deferUpdate();
      const r = await checkGuild(guild);
      return interaction.followUp({ embeds: [healthEmbed(r)], flags: EPH });
    }

    case 'webhook': {
      await interaction.deferUpdate();
      const url = cfg.webhookUrl || process.env.RAID_WEBHOOK_URL;
      if (!url) return interaction.followUp({ content: 'Chưa có webhook. Dùng `/security webhook`.', flags: EPH });
      const ok = await sendWebhook(url, { embeds: [safeEmbed({ title: 'Thử webhook', description: 'Cảnh báo raid sẽ gửi về đây.', color: COLORS.ok })] });
      return interaction.followUp({ content: ok ? 'Đã gửi thử thành công.' : 'Gửi thất bại (URL sai, webhook bị xóa, hoặc bấm quá nhanh).', flags: EPH });
    }

    case 'purge': {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) return reply('Bạn cần quyền **Manage Messages**.');
      await interaction.deferUpdate();
      const ids = getRaiders(guild.id);
      if (!ids.length) return interaction.followUp({ content: 'Chưa có raider nào được ghi nhận (chỉ có khi bot phát hiện raid).', flags: EPH });
      const n = await purgeUsers(guild, ids);
      await sendModLog(guild, { title: '🧹 Xóa tin raider', description: `${n} tin của ${ids.length} tài khoản (từ bảng điều khiển).`, user: interaction.user, color: COLORS.info });
      return interaction.followUp({ content: `Đã xóa ${n} tin của ${ids.length} tài khoản.`, flags: EPH });
    }

    default:
      return reply('Nút này không còn dùng. Hãy chạy lại `/panel control`.');
  }
}

module.exports = { render, handle, isPanelId };
