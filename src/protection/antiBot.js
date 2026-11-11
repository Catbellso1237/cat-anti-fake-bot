'use strict';
// Chặn bot lạ do người không tin cậy thêm vào, và cảnh báo bot giả mạo tên.
const { AuditLogEvent } = require('discord.js');
const { sleep } = require('../utils/time');

function levenshtein(a, b) {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Tên gần giống (nhưng không trùng) với bot tin cậy hoặc staff -> nghi giả mạo
async function findImpersonation(member, cfg) {
  const name = norm(member.user.username);
  if (name.length < 4) return null;
  const targets = [];
  for (const id of cfg.trustedBotIds) {
    const m = await member.guild.members.fetch(id).catch(() => null);
    if (m) targets.push(m);
  }
  for (const id of cfg.trustedUserIds) {
    const m = await member.guild.members.fetch(id).catch(() => null);
    if (m) targets.push(m);
  }
  for (const t of targets) {
    if (t.id === member.id) continue;
    const other = norm(t.user.username);
    const d = levenshtein(name, other);
    if (d <= Math.max(1, Math.floor(other.length / 6))) return t;
  }
  return null;
}

// Trả về { trusted, adderId, unknown }
async function checkBotAdder(member, cfg) {
  if (cfg.trustedBotIds.includes(member.id)) return { trusted: true, adderId: null };
  await sleep(1500); // audit log có độ trễ
  const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 }).catch(() => null);
  const entry = logs?.entries.find((e) => e.target?.id === member.id && Date.now() - e.createdTimestamp < 30_000);
  const adderId = entry?.executor?.id ?? null;
  const trusted = Boolean(
    adderId && (adderId === member.guild.ownerId || cfg.trustedUserIds.includes(adderId)),
  );
  // unknown: không đọc được audit log (thiếu quyền View Audit Log) hoặc chưa có mục. Chỉ cảnh báo, không kick.
  return { trusted, adderId, unknown: !adderId };
}

module.exports = { checkBotAdder, findImpersonation, levenshtein };
