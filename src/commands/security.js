'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getConfig, saveConfig } = require('../config');
const { safeEmbed, COLORS } = require('../utils/embed');
const { isValidWebhookUrl, maskWebhook, sendWebhook } = require('../utils/webhook');
const { isRaidActive } = require('../protection/raid');

const EPH = MessageFlags.Ephemeral;

const data = new SlashCommandBuilder()
  .setName('security')
  .setDescription('Cấu hình hệ thống bảo vệ server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName('status').setDescription('Xem cấu hình hiện tại'))
  .addSubcommand((s) =>
    s
      .setName('mode')
      .setDescription('Chuyển giữa chỉ ghi log và xử lý thật')
      .addStringOption((o) =>
        o
          .setName('value')
          .setDescription('Chế độ')
          .setRequired(true)
          .addChoices({ name: 'log (chỉ ghi log, an toàn)', value: 'log' }, { name: 'act (xử lý thật)', value: 'act' }),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('raid')
      .setDescription('Chỉnh ngưỡng phát hiện raid và phản ứng tự động')
      .addIntegerOption((o) => o.setName('max_joins').setDescription('Số người vào để tính là raid').setMinValue(2).setMaxValue(50))
      .addIntegerOption((o) => o.setName('seconds').setDescription('Trong bao nhiêu giây').setMinValue(3).setMaxValue(120))
      .addIntegerOption((o) => o.setName('lockdown_minutes').setDescription('Tự mở khóa sau (phút)').setMinValue(1).setMaxValue(240))
      .addBooleanOption((o) => o.setName('auto_lockdown').setDescription('Tự khóa kênh khi raid'))
      .addBooleanOption((o) => o.setName('purge_raiders').setDescription('Tự xóa tin của người vào lúc raid'))
      .addBooleanOption((o) => o.setName('raise_verification').setDescription('Tự tăng mức xác minh server')),
  )
  .addSubcommand((s) =>
    s
      .setName('accountage')
      .setDescription('Tuổi tối thiểu của tài khoản (ngày)')
      .addIntegerOption((o) => o.setName('days').setDescription('Số ngày').setRequired(true).setMinValue(0).setMaxValue(365)),
  )
  .addSubcommand((s) =>
    s
      .setName('logchannel')
      .setDescription('Đặt kênh mod-log')
      .addChannelOption((o) => o.setName('channel').setDescription('Kênh').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName('webhook')
      .setDescription('Đặt webhook nhận cảnh báo raid (để trống để xóa)')
      .addStringOption((o) => o.setName('url').setDescription('URL webhook Discord')),
  )
  .addSubcommand((s) =>
    s
      .setName('escalation')
      .setDescription('Chống cấp quyền hoặc role nguy hiểm trái phép (kiểu Wick)')
      .addBooleanOption((o) => o.setName('enabled').setDescription('Bật hoặc tắt'))
      .addBooleanOption((o) => o.setName('revert').setDescription('Tự hoàn tác ở chế độ act')),
  )
  .addSubcommand((s) =>
    s
      .setName('botapproval')
      .setDescription('Bot mới vào phải được chủ server duyệt')
      .addBooleanOption((o) => o.setName('enabled').setDescription('Bật hoặc tắt'))
      .addIntegerOption((o) => o.setName('timeout_minutes').setDescription('Hết hạn sau (phút)').setMinValue(1).setMaxValue(60)),
  )
  .addSubcommand((s) => s.setName('webhook_test').setDescription('Gửi thử một cảnh báo qua webhook'))
  .addSubcommand((s) =>
    s
      .setName('trust')
      .setDescription('Thêm hoặc bỏ người/bot tin cậy (không bị luật xử lý)')
      .addStringOption((o) =>
        o.setName('action').setDescription('Thêm hoặc bỏ').setRequired(true).addChoices({ name: 'thêm', value: 'add' }, { name: 'bỏ', value: 'remove' }),
      )
      .addUserOption((o) => o.setName('user').setDescription('Người dùng hoặc bot').setRequired(true)),
  );

const yn = (b) => (b ? 'bật' : 'tắt');

async function execute(interaction) {
  const cfg = getConfig(interaction.guildId);
  const sub = interaction.options.getSubcommand();
  const reply = (content) => interaction.reply({ content, flags: EPH });

  switch (sub) {
    case 'status': {
      const embed = safeEmbed({
        title: 'Cat Anti Fake Bot: cấu hình',
        color: cfg.mode === 'act' ? COLORS.danger : COLORS.info,
        fields: [
          { name: 'Chế độ', value: cfg.mode, inline: true },
          { name: 'Đang raid', value: isRaidActive(interaction.guildId) ? 'có' : 'không', inline: true },
          { name: 'Lockdown', value: cfg.lockdown ? `đang khóa ${Object.keys(cfg.lockdown.snapshot).length} kênh` : 'không', inline: true },
          { name: 'Kênh log', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : '(chưa đặt, dùng /setup)', inline: true },
          { name: 'Webhook', value: maskWebhook(cfg.webhookUrl), inline: true },
          { name: 'Role xác minh', value: cfg.verifiedRoleId ? `<@&${cfg.verifiedRoleId}>` : '(chưa đặt)', inline: true },
          {
            name: 'Raid',
            value: `${cfg.raid.maxJoins} người / ${cfg.raid.windowMs / 1000}s · auto lockdown ${yn(cfg.raid.autoLockdown)} (${Math.round(cfg.raid.lockdownMs / 60000)} phút) · xóa tin raider ${yn(cfg.raid.purgeRaiders)} · tăng xác minh ${yn(cfg.raid.raiseVerification)}`,
          },
          { name: 'Duyệt bot mới', value: `${yn(cfg.botApproval.enabled)} (${Object.keys(cfg.pendingBots).length} chờ)`, inline: true },
          { name: 'Chống leo thang quyền', value: `${yn(cfg.escalation.enabled)}${cfg.escalation.revert ? ', tự hoàn tác' : ''}`, inline: true },
          { name: 'Tuổi tài khoản tối thiểu', value: `${Math.round(cfg.minAccountAgeMs / 86_400_000)} ngày`, inline: true },
          { name: 'Tin cậy', value: `${cfg.trustedUserIds.length} người, ${cfg.trustedBotIds.length} bot`, inline: true },
        ],
      });
      return interaction.reply({ embeds: [embed], flags: EPH });
    }
    case 'mode': {
      cfg.mode = interaction.options.getString('value', true);
      await saveConfig();
      return reply(
        cfg.mode === 'act'
          ? 'Đã chuyển sang **act**: bot sẽ timeout, kick, khóa kênh thật. Kiểm tra role của bot cao hơn các role cần quản lý.'
          : 'Đã chuyển sang **log**: bot chỉ ghi log, không xử lý.',
      );
    }
    case 'raid': {
      const o = interaction.options;
      if (o.getInteger('max_joins') != null) cfg.raid.maxJoins = o.getInteger('max_joins');
      if (o.getInteger('seconds') != null) cfg.raid.windowMs = o.getInteger('seconds') * 1000;
      if (o.getInteger('lockdown_minutes') != null) cfg.raid.lockdownMs = o.getInteger('lockdown_minutes') * 60_000;
      if (o.getBoolean('auto_lockdown') != null) cfg.raid.autoLockdown = o.getBoolean('auto_lockdown');
      if (o.getBoolean('purge_raiders') != null) cfg.raid.purgeRaiders = o.getBoolean('purge_raiders');
      if (o.getBoolean('raise_verification') != null) cfg.raid.raiseVerification = o.getBoolean('raise_verification');
      await saveConfig();
      return reply(`Đã lưu: ${cfg.raid.maxJoins} người / ${cfg.raid.windowMs / 1000}s, auto lockdown ${yn(cfg.raid.autoLockdown)}, mở khóa sau ${Math.round(cfg.raid.lockdownMs / 60000)} phút.`);
    }
    case 'escalation': {
      const o = interaction.options;
      if (o.getBoolean('enabled') != null) cfg.escalation.enabled = o.getBoolean('enabled');
      if (o.getBoolean('revert') != null) cfg.escalation.revert = o.getBoolean('revert');
      await saveConfig();
      return reply(`Chống leo thang quyền: ${yn(cfg.escalation.enabled)}, tự hoàn tác (chế độ act): ${yn(cfg.escalation.revert)}. Chỉ owner và người trong /security trust được phép cấp quyền nguy hiểm.`);
    }
    case 'botapproval': {
      const o = interaction.options;
      if (o.getBoolean('enabled') != null) cfg.botApproval.enabled = o.getBoolean('enabled');
      if (o.getInteger('timeout_minutes') != null) cfg.botApproval.timeoutMs = o.getInteger('timeout_minutes') * 60_000;
      await saveConfig();
      return reply(`Duyệt bot mới: ${yn(cfg.botApproval.enabled)}, hết hạn sau ${Math.round(cfg.botApproval.timeoutMs / 60000)} phút. Bot do chủ server hoặc người tin cậy thêm vào được bỏ qua bước này.`);
    }
    case 'accountage': {
      cfg.minAccountAgeMs = interaction.options.getInteger('days', true) * 86_400_000;
      await saveConfig();
      return reply(`Tài khoản dưới ${Math.round(cfg.minAccountAgeMs / 86_400_000)} ngày sẽ bị đánh dấu.`);
    }
    case 'logchannel': {
      const ch = interaction.options.getChannel('channel', true);
      cfg.logChannelId = ch.id;
      await saveConfig();
      return reply(`Kênh mod-log: <#${ch.id}>`);
    }
    case 'webhook': {
      const url = interaction.options.getString('url');
      if (!url) {
        cfg.webhookUrl = null;
        await saveConfig();
        return reply('Đã xóa webhook của server.');
      }
      if (!isValidWebhookUrl(url.trim())) return reply('URL không phải webhook Discord hợp lệ (dạng https://discord.com/api/webhooks/ID/TOKEN).');
      cfg.webhookUrl = url.trim();
      await saveConfig();
      return reply(`Đã lưu webhook: ${maskWebhook(cfg.webhookUrl)}. Dùng /security webhook_test để thử.`);
    }
    case 'webhook_test': {
      const url = cfg.webhookUrl || process.env.RAID_WEBHOOK_URL;
      if (!url) return reply('Chưa có webhook. Dùng /security webhook trước.');
      await interaction.deferReply({ flags: EPH });
      const ok = await sendWebhook(url, { embeds: [safeEmbed({ title: 'Thử webhook', description: 'Cảnh báo raid sẽ gửi về đây.', color: COLORS.ok })] });
      return interaction.editReply(ok ? 'Đã gửi thử thành công.' : 'Gửi thất bại (URL sai, webhook bị xóa, hoặc gửi quá nhanh).');
    }
    case 'trust': {
      const user = interaction.options.getUser('user', true);
      const list = user.bot ? cfg.trustedBotIds : cfg.trustedUserIds;
      const add = interaction.options.getString('action', true) === 'add';
      const i = list.indexOf(user.id);
      if (add && i === -1) list.push(user.id);
      if (!add && i !== -1) list.splice(i, 1);
      await saveConfig();
      return reply(`${add ? 'Đã thêm' : 'Đã bỏ'} ${user.tag} ${user.bot ? '(bot)' : ''} ${add ? 'vào' : 'khỏi'} danh sách tin cậy.`);
    }
    default:
      return reply('Lệnh con không hợp lệ.');
  }
}

module.exports = { data, execute, cooldownSeconds: 2 };
