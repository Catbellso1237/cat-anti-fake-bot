'use strict';
// Đếm hành động phá hoại (xóa kênh/role, ban hàng loạt) theo từng người thực hiện.
const { AuditLogEvent } = require('discord.js');
const { getConfig } = require('../config');
const { sendModLog } = require('../utils/log');
const { COLORS } = require('../utils/embed');

const actions = new Map(); // `${guildId}:${executorId}:${type}` -> mảng timestamp

function bump(key, windowMs) {
  const now = Date.now();
  const arr = (actions.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  actions.set(key, arr);
  return arr.length;
}

// Tìm người thực hiện hành động vừa xảy ra từ audit log (độ trễ nhỏ nên nhìn 5 mục gần nhất)
async function findExecutor(guild, type, targetId) {
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  const entry = logs?.entries.find(
    (e) => (!targetId || e.target?.id === targetId) && Date.now() - e.createdTimestamp < 5_000,
  );
  return entry?.executor ?? null;
}

// Gọi từ các sự kiện xóa kênh/role, ban. Đạt ngưỡng thì gỡ role của người thực hiện (chế độ act).
async function handleDestructive(guild, type, targetId, label) {
  const cfg = getConfig(guild.id);
  const executor = await findExecutor(guild, type, targetId);
  if (!executor) return;
  if (executor.id === guild.client.user.id || executor.id === guild.ownerId) return;
  if (cfg.trustedUserIds.includes(executor.id) || cfg.trustedBotIds.includes(executor.id)) return;

  const count = bump(`${guild.id}:${executor.id}:${type}`, cfg.nuke.windowMs);
  if (count !== cfg.nuke.maxActions) return; // chỉ xử lý một lần khi chạm ngưỡng

  let action = 'Chỉ ghi log';
  if (cfg.mode === 'act') {
    const member = await guild.members.fetch(executor.id).catch(() => null);
    const me = guild.members.me;
    if (member && me && member.manageable) {
      const keep = member.roles.cache.filter((r) => r.managed || r.id === guild.id || r.position >= me.roles.highest.position);
      const ok = await member.roles.set([...keep.keys()], 'Anti-nuke: hành động phá hoại hàng loạt').then(() => true, () => false);
      action = ok ? 'Đã gỡ role của người thực hiện' : 'Gỡ role thất bại';
    } else {
      action = 'Không đủ quyền để gỡ role (đặt role bot cao hơn)';
    }
  }
  await sendModLog(guild, {
    title: '☢️ Anti-nuke kích hoạt',
    description: `${label}: ${count} lần trong ${Math.round(cfg.nuke.windowMs / 1000)} giây.`,
    user: executor,
    action,
    color: COLORS.danger,
    alert: true,
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of actions) {
    if (!arr.length || now - arr[arr.length - 1] > 60_000) actions.delete(k);
  }
}, 60_000).unref();

module.exports = { bump, findExecutor, handleDestructive, AuditLogEvent };
