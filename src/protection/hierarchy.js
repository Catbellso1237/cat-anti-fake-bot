'use strict';
// Lấy dữ liệu thật từ guild rồi đưa cho analyze(). Dùng cho /health, khi bot khởi động,
// khi vào server mới và khi thứ tự role thay đổi.
const { getConfig } = require('../config');
const { sendModLog } = require('../utils/log');
const { COLORS, safeEmbed } = require('../utils/embed');
const { isValidWebhookUrl } = require('../utils/webhook');
const { DANGEROUS, REQUIRED, analyze } = require('./hierarchyCheck');

const MEMBER_FETCH_LIMIT = 1500; // server lớn hơn thì dùng số liệu trong cache để khỏi tốn tài nguyên

async function snapshot(guild, cfg) {
  const me = guild.members.me ?? (await guild.members.fetchMe());
  await guild.roles.fetch().catch(() => {});
  if (guild.memberCount <= MEMBER_FETCH_LIMIT) await guild.members.fetch().catch(() => {});

  const roles = guild.roles.cache.map((r) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    managed: r.managed,
    everyone: r.id === guild.id,
    // has(perm, false): không coi Administrator là có mọi quyền, để liệt kê đúng quyền được cấp
    dangerous: DANGEROUS.filter((p) => r.permissions.has(p, false)),
    memberCount: r.members.size,
  }));

  const verified = cfg.verifiedRoleId ? guild.roles.cache.get(cfg.verifiedRoleId) : null;

  let logChannel = 'unset';
  if (cfg.logChannelId) {
    const ch = await guild.channels.fetch(cfg.logChannelId).catch(() => null);
    if (!ch) logChannel = 'missing';
    else logChannel = ch.permissionsFor(me)?.has(['ViewChannel', 'SendMessages', 'EmbedLinks']) ? 'ok' : 'noaccess';
  }

  const url = cfg.webhookUrl || process.env.RAID_WEBHOOK_URL;

  return {
    botTopPosition: me.roles.highest.position,
    botHas: REQUIRED.map(([p]) => p).filter((p) => me.permissions.has(p)),
    roles,
    verifiedRole: verified ? { name: verified.name, position: verified.position } : null,
    verifiedRoleMissing: Boolean(cfg.verifiedRoleId && !verified),
    logChannel,
    webhook: !url ? 'none' : isValidWebhookUrl(url) ? 'ok' : 'invalid',
    mode: cfg.mode,
  };
}

const ICON = { error: '❌', warn: '⚠️', info: 'ℹ️' };
const formatIssues = (issues) => issues.map((x) => `${ICON[x.level]} ${x.text}`).join('\n');

function healthEmbed(r) {
  const errors = r.issues.filter((x) => x.level === 'error').length;
  const warns = r.issues.filter((x) => x.level === 'warn').length;
  return safeEmbed({
    title: r.ok ? '✅ Kiểm tra: không có lỗi nghiêm trọng' : '❌ Kiểm tra: có lỗi cần sửa',
    description: r.issues.length ? formatIssues(r.issues) : 'Mọi thứ đều ổn.',
    color: r.ok ? (warns ? COLORS.warn : COLORS.ok) : COLORS.danger,
    fields: [
      { name: 'Role bot ở trên cùng', value: r.botIsTop ? 'có' : `không (${r.aboveCount} role nằm trên)`, inline: true },
      { name: 'Lỗi / cảnh báo', value: `${errors} / ${warns}`, inline: true },
    ],
    footer: 'Số thành viên mỗi role tính theo cache nên có thể thiếu ở server lớn.',
  });
}

async function checkGuild(guild) {
  const cfg = getConfig(guild.id);
  return analyze(await snapshot(guild, cfg));
}

const lastWarn = new Map(); // guildId -> timestamp, tránh báo lặp
const WARN_INTERVAL_MS = 30 * 60_000;

// Chỉ báo vào mod-log khi có lỗi (error); trả về kết quả phân tích.
async function maybeWarnHealth(guild, { force = false } = {}) {
  const result = await checkGuild(guild);
  const last = lastWarn.get(guild.id) ?? 0;
  if (!result.ok && (force || Date.now() - last > WARN_INTERVAL_MS)) {
    lastWarn.set(guild.id, Date.now());
    await sendModLog(guild, {
      title: '🩺 Kiểm tra quyền: phát hiện vấn đề',
      description: formatIssues(result.issues.filter((x) => x.level !== 'info')),
      color: COLORS.warn,
      alert: true,
    });
  }
  return result;
}

// Đổi thứ tự role thường bắn hàng loạt sự kiện: gom lại, 30 giây sau sự kiện đầu tiên kiểm tra đúng một lần.
const pending = new Map();
function scheduleHealthCheck(guild, delayMs = 30_000) {
  if (pending.has(guild.id)) return;
  const t = setTimeout(() => {
    pending.delete(guild.id);
    maybeWarnHealth(guild).catch((err) => console.warn(`Health check ${guild.name} lỗi:`, err.message));
  }, delayMs);
  t.unref();
  pending.set(guild.id, t);
}

module.exports = { checkGuild, maybeWarnHealth, scheduleHealthCheck, formatIssues, healthEmbed };
