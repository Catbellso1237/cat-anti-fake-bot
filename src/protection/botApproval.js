'use strict';
// Duyệt bot mới: bot lạ vào server thì bị tạm gỡ quyền (chế độ act) và chủ server phải xác nhận.
// Cho phép = chấp nhận rủi ro: bot được khôi phục quyền và đưa vào danh sách tin cậy.
// Từ chối hoặc hết hạn (chế độ act) = kick.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getConfig, saveConfig } = require('../config');
const { safeEmbed, COLORS } = require('../utils/embed');
const { relative } = require('../utils/time');
const { sendModLog } = require('../utils/log');
const { sendWebhook } = require('../utils/webhook');
const { DANGEROUS } = require('./hierarchyCheck');
const { buildId, parseId } = require('./botApprovalId');

const MAX_PENDING = 10; // chống bị spam hàng loạt bot

const list = (a) => (a.length ? a.join(', ') : 'không có');

function requestEmbed(p, cfg) {
  const state = p.neutralized
    ? 'Quyền của bot đã bị **tạm gỡ về 0** cho tới khi bạn quyết định.'
    : cfg.mode === 'act'
      ? 'Không gỡ được quyền (role của bot đó nằm trên bot bảo vệ). Hãy xử lý nhanh.'
      : 'Chế độ log: bot chưa bị hạn chế.';
  return safeEmbed({
    title: `🤖 Bot mới xin quyền: ${p.name}`,
    description: 'Bot này vừa được thêm vào server. Bạn có cho phép nó hoạt động không?',
    color: COLORS.warn,
    fields: [
      { name: 'Bot', value: `${p.name} (${p.botId})`, inline: true },
      { name: 'Thêm bởi', value: p.adderId ? `<@${p.adderId}>` : 'không xác định', inline: true },
      { name: 'Hết hạn', value: `${relative(p.expiresAt)}${cfg.mode === 'act' ? ', tự kick nếu không phản hồi' : ''}`, inline: true },
      { name: 'Quyền bot yêu cầu', value: list(p.perms), inline: false },
      { name: 'Quyền nguy hiểm', value: list(p.dangerous), inline: false },
      { name: 'Trạng thái', value: state, inline: false },
      ...(p.lookalikeOf ? [{ name: '⚠️ Nghi giả mạo', value: `Tên gần giống **${p.lookalikeOf}** nhưng ID khác.`, inline: false }] : []),
    ],
    footer: 'Chỉ chủ server và người trong danh sách tin cậy được quyết định.',
  });
}

function requestRows(guildId, botId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(buildId('allow', guildId, botId)).setLabel('Cho phép').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(buildId('deny', guildId, botId)).setLabel('Từ chối và kick').setStyle(ButtonStyle.Danger),
    ),
  ];
}

function confirmView(p, guildId) {
  return {
    embeds: [
      safeEmbed({
        title: `⚠️ Xác nhận lần cuối: ${p.name}`,
        description: [
          `Cho phép **${p.name}** nghĩa là bạn **chấp nhận mọi hậu quả**.`,
          'Nếu bot này độc hại hoặc bị chiếm quyền, nó có thể phá hoặc chiếm server Discord của bạn (xóa kênh, ban thành viên, tạo webhook, cấp quyền…).',
          'Cat Anti Fake Bot sẽ khôi phục quyền gốc và **không chặn bot này nữa** (thêm vào danh sách tin cậy).',
        ].join('\n'),
        color: COLORS.danger,
        fields: [{ name: 'Quyền nguy hiểm của bot', value: list(p.dangerous) }],
      }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(buildId('confirm', guildId, p.botId)).setLabel('Tôi hiểu rủi ro, cho phép').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(buildId('cancel', guildId, p.botId)).setLabel('Quay lại').setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

const doneView = (title, description, color) => ({ embeds: [safeEmbed({ title, description, color })], components: [] });

// Gửi tin nhắn yêu cầu vào kênh mod-log, nếu không được thì DM chủ server.
async function postRequest(guild, cfg, p) {
  const payload = { embeds: [requestEmbed(p, cfg)], components: requestRows(guild.id, p.botId) };
  if (cfg.logChannelId) {
    const ch = await guild.channels.fetch(cfg.logChannelId).catch(() => null);
    const msg = ch?.isTextBased() ? await ch.send(payload).catch(() => null) : null;
    if (msg) return { type: 'channel', id: ch.id, messageId: msg.id };
  }
  const owner = await guild.fetchOwner().catch(() => null);
  const msg = owner ? await owner.send(payload).catch(() => null) : null;
  if (msg) return { type: 'dm', id: owner.id, messageId: msg.id };
  return null;
}

async function editOriginal(client, p, payload) {
  try {
    const t = p.target;
    if (!t) return;
    const channel = t.type === 'channel' ? await client.channels.fetch(t.id) : await (await client.users.fetch(t.id)).createDM();
    const msg = await channel.messages.fetch(t.messageId);
    await msg.edit(payload);
  } catch {
    // tin nhắn đã bị xóa hoặc không sửa được: bỏ qua
  }
}

async function requestApproval(member, cfg, { adderId, lookalike } = {}) {
  const guild = member.guild;
  const acting = cfg.mode === 'act';

  if (Object.keys(cfg.pendingBots).length >= MAX_PENDING) {
    if (acting && member.kickable) await member.kick('Quá nhiều bot chờ duyệt').catch(() => {});
    await sendModLog(guild, { title: '🤖 Quá nhiều bot chờ duyệt', description: `Bot ${member.user.tag} bị ${acting ? 'kick' : 'bỏ qua (chế độ log)'}.`, user: member.user, color: COLORS.danger, alert: true });
    return;
  }

  const role = member.roles.botRole ?? null;
  const p = {
    botId: member.id,
    name: member.user.tag,
    adderId: adderId ?? null,
    requestedAt: Date.now(),
    expiresAt: Date.now() + cfg.botApproval.timeoutMs,
    roleId: role?.id ?? null,
    origPerms: role ? role.permissions.bitfield.toString() : null,
    neutralized: false,
    perms: role ? role.permissions.toArray() : [],
    dangerous: role ? DANGEROUS.filter((x) => role.permissions.has(x, false)) : [],
    lookalikeOf: lookalike?.user.tag ?? null,
    target: null,
  };

  // Chế độ act: tạm gỡ quyền của bot cho tới khi có quyết định
  if (acting && role?.editable) {
    p.neutralized = await role.setPermissions(0n, 'Chờ chủ server duyệt bot mới').then(() => true, () => false);
  }

  p.target = await postRequest(guild, cfg, p);
  if (!p.target) {
    // Không có chỗ để hỏi: an toàn nhất là không cho bot tiếp tục (chế độ act)
    if (acting && member.kickable) await member.kick('Không gửi được yêu cầu duyệt bot').catch(() => {});
    await sendModLog(guild, { title: '🤖 Không gửi được yêu cầu duyệt bot', description: 'Không có kênh mod-log và chủ server đang tắt DM. Hãy chạy /setup.', user: member.user, color: COLORS.danger, alert: true });
    return;
  }

  cfg.pendingBots[p.botId] = p;
  await saveConfig();

  // Cảnh báo qua webhook (webhook không gắn được nút nên chỉ báo cho biết có yêu cầu)
  const url = cfg.webhookUrl || process.env.RAID_WEBHOOK_URL;
  if (url) {
    await sendWebhook(url, { embeds: [safeEmbed({ title: `🤖 Bot mới chờ duyệt: ${p.name}`, description: `Quyền nguy hiểm: ${list(p.dangerous)}\nMở ${p.target.type === 'channel' ? `<#${p.target.id}>` : 'tin nhắn riêng với bot'} để quyết định.`, color: COLORS.warn })] });
  }
}

async function handle(interaction) {
  const parsed = parseId(interaction.customId);
  const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  if (!parsed) return reply('Nút không hợp lệ.');

  const guild = interaction.client.guilds.cache.get(parsed.guildId);
  if (!guild) return reply('Bot bảo vệ không còn ở server này.');
  const cfg = getConfig(guild.id);
  const p = cfg.pendingBots[parsed.botId];
  if (!p) return interaction.update(doneView('Yêu cầu đã xử lý hoặc hết hạn', 'Không còn gì để quyết định.', COLORS.info));

  const allowed = interaction.user.id === guild.ownerId || cfg.trustedUserIds.includes(interaction.user.id);
  if (!allowed) return reply('Chỉ chủ server hoặc người trong danh sách tin cậy được quyết định.');

  const finish = async (title, description, color) => {
    delete cfg.pendingBots[p.botId];
    await saveConfig();
    await sendModLog(guild, { title, description, user: interaction.user, color });
    return interaction.update(doneView(title, description, color));
  };

  switch (parsed.action) {
    case 'allow':
      return interaction.update(confirmView(p, guild.id));
    case 'cancel':
      return interaction.update({ embeds: [requestEmbed(p, cfg)], components: requestRows(guild.id, p.botId) });

    case 'deny': {
      const member = await guild.members.fetch(p.botId).catch(() => null);
      let result = 'Bot đã rời server.';
      if (member) {
        result = member.kickable
          ? await member.kick(`Từ chối bởi ${interaction.user.tag}`).then(() => 'Đã kick bot.', () => 'Kick thất bại.')
          : 'Không đủ quyền kick (role bot đó cao hơn bot bảo vệ).';
      }
      return finish(`❌ Đã từ chối bot ${p.name}`, result, COLORS.danger);
    }

    case 'confirm': {
      const role = p.neutralized && p.roleId ? await guild.roles.fetch(p.roleId).catch(() => null) : null;
      let restored = 'Không có quyền cần khôi phục.';
      if (p.neutralized) {
        restored = role
          ? await role.setPermissions(BigInt(p.origPerms), `Cho phép bởi ${interaction.user.tag}`).then(() => 'Đã khôi phục quyền gốc của bot.', () => 'Khôi phục quyền thất bại, hãy chỉnh role thủ công.')
          : 'Không tìm thấy role của bot để khôi phục.';
      }
      if (!cfg.trustedBotIds.includes(p.botId)) cfg.trustedBotIds.push(p.botId);
      return finish(`✅ Đã cho phép bot ${p.name}`, `${restored}\nNgười quyết định: ${interaction.user.tag}, đã chấp nhận rủi ro. Bot được thêm vào danh sách tin cậy.`, COLORS.ok);
    }

    default:
      return reply('Nút không hợp lệ.');
  }
}

// Chạy định kỳ: xử lý yêu cầu hết hạn (kể cả sau khi bot khởi động lại).
async function expire(client) {
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    const cfg = getConfig(guild.id);
    for (const p of Object.values(cfg.pendingBots)) {
      const member = guild.members.cache.get(p.botId) ?? (await guild.members.fetch(p.botId).catch(() => null));
      if (member && p.expiresAt > now) continue;
      delete cfg.pendingBots[p.botId];
      await saveConfig();
      if (!member) {
        await editOriginal(client, p, doneView('Bot đã rời server', `${p.name} không còn trong server.`, COLORS.info));
        continue;
      }
      const acting = cfg.mode === 'act';
      const result = acting ? (member.kickable ? await member.kick('Hết hạn duyệt bot').then(() => 'Đã kick bot.', () => 'Kick thất bại.') : 'Không đủ quyền kick.') : 'Chế độ log nên chưa kick.';
      await editOriginal(client, p, doneView(`⌛ Hết hạn duyệt bot ${p.name}`, result, COLORS.warn));
      await sendModLog(guild, { title: `⌛ Hết hạn duyệt bot ${p.name}`, description: result, color: COLORS.warn, alert: true });
    }
  }
}

module.exports = { requestApproval, handle, expire };
