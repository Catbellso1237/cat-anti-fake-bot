'use strict';
// Phát hiện raid + tự động xử lý: lockdown kênh, tăng mức xác minh, xóa tin của raider, báo webhook.
const { ChannelType, GuildVerificationLevel } = require('discord.js');
const { getConfig, saveConfig } = require('../config');
const { sendModLog } = require('../utils/log');
const { COLORS } = require('../utils/embed');
const { sleep, relative } = require('../utils/time');

const joinLog = new Map(); // guildId -> mảng { t, id }
const raidState = new Map(); // guildId -> { until, raiderIds:Set }
const recentMsgs = new Map(); // `${guildId}:${userId}` -> [{channelId, id, ts}]
const MSG_TTL_MS = 30 * 60_000;
const MAX_MSGS_PER_USER = 25;

const LOCKABLE = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum]);

// ---------- Phát hiện ----------
// Trả về { raid, recentIds }: recentIds là những người vừa vào trong cửa sổ thời gian.
function recordJoin(guildId, cfg, userId) {
  const now = Date.now();
  const arr = (joinLog.get(guildId) ?? []).filter((j) => now - j.t < cfg.raid.windowMs);
  arr.push({ t: now, id: userId });
  joinLog.set(guildId, arr);
  return { raid: arr.length >= cfg.raid.maxJoins, recentIds: arr.map((j) => j.id) };
}

const isRaidActive = (guildId) => (raidState.get(guildId)?.until ?? 0) > Date.now();
const getRaiders = (guildId) => [...(raidState.get(guildId)?.raiderIds ?? [])];
const isRaider = (guildId, userId) => raidState.get(guildId)?.raiderIds.has(userId) ?? false;

function markRaider(guildId, userId) {
  const st = raidState.get(guildId);
  if (st) st.raiderIds.add(userId);
}

// ---------- Theo dõi tin nhắn để có thể xóa khi raid ----------
function trackMessage(msg) {
  const key = `${msg.guild.id}:${msg.author.id}`;
  const arr = recentMsgs.get(key) ?? [];
  arr.push({ channelId: msg.channelId, id: msg.id, ts: Date.now() });
  if (arr.length > MAX_MSGS_PER_USER) arr.shift();
  recentMsgs.set(key, arr);
}

async function purgeUsers(guild, userIds) {
  const byChannel = new Map();
  for (const uid of userIds) {
    const key = `${guild.id}:${uid}`;
    for (const m of recentMsgs.get(key) ?? []) {
      if (!byChannel.has(m.channelId)) byChannel.set(m.channelId, []);
      byChannel.get(m.channelId).push(m.id);
    }
    recentMsgs.delete(key);
  }
  let deleted = 0;
  for (const [channelId, ids] of byChannel) {
    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (!ch?.isTextBased() || !('bulkDelete' in ch)) continue;
    // bulkDelete(…, true) tự bỏ qua tin quá 14 ngày; mỗi lần tối đa 100 tin
    for (let i = 0; i < ids.length; i += 100) {
      const res = await ch.bulkDelete(ids.slice(i, i + 100), true).catch(() => null);
      deleted += res?.size ?? 0;
    }
  }
  return deleted;
}

// ---------- Lockdown ----------
async function lockdownInner(guild, cfg, { durationMs, reason = 'Cat Anti Fake Bot: lockdown' } = {}) {
  const everyone = guild.roles.everyone;
  const snapshot = cfg.lockdown?.snapshot ?? {};
  let locked = 0;

  for (const ch of guild.channels.cache.values()) {
    if (!LOCKABLE.has(ch.type) || ch.id === cfg.logChannelId) continue;
    if (ch.id in snapshot) continue; // đã khóa ở lần trước, giữ nguyên bản ghi gốc
    const current = ch.permissionOverwrites.cache.get(everyone.id);
    // true = đang cho phép, false = đang cấm, null = chưa đặt
    const prev = current?.allow.has('SendMessages') ? true : current?.deny.has('SendMessages') ? false : null;
    snapshot[ch.id] = prev;
    if (prev === false) continue;
    await ch.permissionOverwrites.edit(everyone, { SendMessages: false, AddReactions: false }, { reason }).catch((e) => {
      console.warn(`Không khóa được #${ch.name}: ${e.message}`);
      delete snapshot[ch.id];
    });
    locked++;
    await sleep(300); // tránh rate limit khi sửa nhiều kênh
  }

  let prevVerification = cfg.lockdown?.prevVerification ?? null;
  if (cfg.raid.raiseVerification && guild.verificationLevel < GuildVerificationLevel.High) {
    prevVerification ??= guild.verificationLevel;
    await guild.setVerificationLevel(GuildVerificationLevel.High, reason).catch(() => {});
  }

  cfg.lockdown = { until: Date.now() + (durationMs ?? cfg.raid.lockdownMs), snapshot, prevVerification };
  await saveConfig();
  return locked;
}

async function unlockInner(guild, cfg, reason = 'Cat Anti Fake Bot: mở khóa') {
  const ld = cfg.lockdown;
  if (!ld) return 0;
  const everyone = guild.roles.everyone;
  let restored = 0;
  for (const [channelId, prev] of Object.entries(ld.snapshot ?? {})) {
    if (prev === false) continue; // kênh vốn đã cấm gửi tin, bot chưa từng sửa
    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (!ch) continue;
    // prev=null -> xóa ghi đè (trở về mặc định); true -> cho phép như cũ. AddReactions trả về mặc định.
    await ch.permissionOverwrites.edit(everyone, { SendMessages: prev, AddReactions: null }, { reason }).catch(() => {});
    restored++;
    await sleep(300);
  }
  if (ld.prevVerification != null) await guild.setVerificationLevel(ld.prevVerification, reason).catch(() => {});
  cfg.lockdown = null;
  raidState.delete(guild.id);
  await saveConfig();
  return restored;
}

// Mỗi server chỉ cho một thao tác khóa/mở khóa chạy tại một thời điểm.
// Nếu hai thao tác chạy chồng nhau, lần sau sẽ chụp nhầm các kênh vừa bị khóa là "vốn đã cấm" và khôi phục sai quyền.
const busyGuilds = new Set();
async function exclusive(guild, fn) {
  if (busyGuilds.has(guild.id)) return 0;
  busyGuilds.add(guild.id);
  try {
    return await fn();
  } finally {
    busyGuilds.delete(guild.id);
  }
}
const lockdown = (guild, cfg, opts) => exclusive(guild, () => lockdownInner(guild, cfg, opts));
const unlock = (guild, cfg, reason) => exclusive(guild, () => unlockInner(guild, cfg, reason));
const isBusy = (guildId) => busyGuilds.has(guildId);

// ---------- Kích hoạt raid ----------
async function startRaid(guild, cfg, { reason, raiderIds: initial = [] } = {}) {
  const existing = raidState.get(guild.id);
  const until = Date.now() + cfg.raid.lockdownMs;
  if (existing) {
    existing.until = until;
    for (const id of initial) existing.raiderIds.add(id);
    return false; // đã trong trạng thái raid, không xử lý lại
  }
  const raiderIds = new Set(initial);
  raidState.set(guild.id, { until, raiderIds });

  const acting = cfg.mode === 'act';
  const steps = [];
  if (acting && cfg.raid.autoLockdown) {
    const n = await lockdown(guild, cfg);
    steps.push(`Đã khóa ${n} kênh, tự mở sau ${relative(cfg.lockdown?.until ?? until)}`);
  }
  if (acting && cfg.raid.purgeRaiders) {
    const n = await purgeUsers(guild, [...raiderIds]);
    if (n) steps.push(`Đã xóa ${n} tin nhắn của nhóm raid`);
  }
  await sendModLog(guild, {
    title: '🚨 Phát hiện raid',
    description: [reason, ...steps].filter(Boolean).join('\n') || reason,
    action: acting ? (steps.length ? 'Auto lockdown' : 'Chỉ cảnh báo') : 'Chỉ ghi log',
    color: COLORS.danger,
    alert: true,
  });
  return true;
}

// Chạy định kỳ: tự mở khóa khi hết hạn (kể cả sau khi bot khởi động lại) và dọn bộ nhớ.
async function sweep(client) {
  const now = Date.now();
  for (const [k, arr] of recentMsgs) {
    const fresh = arr.filter((m) => now - m.ts < MSG_TTL_MS);
    if (fresh.length) recentMsgs.set(k, fresh);
    else recentMsgs.delete(k);
  }
  for (const [gid, arr] of joinLog) {
    if (!arr.length || now - arr[arr.length - 1].t > 120_000) joinLog.delete(gid);
  }
  for (const [gid, st] of raidState) if (st.until < now) raidState.delete(gid);

  for (const guild of client.guilds.cache.values()) {
    const cfg = getConfig(guild.id);
    if (cfg.lockdown && cfg.lockdown.until < now) {
      const n = await unlock(guild, cfg, 'Hết thời gian lockdown');
      await sendModLog(guild, { title: '✅ Hết lockdown', description: `Đã mở khóa ${n} kênh.`, color: COLORS.ok, alert: true });
    }
  }
}

module.exports = {
  recordJoin, isRaidActive, isRaider, getRaiders, markRaider, trackMessage, purgeUsers,
  lockdown, unlock, isBusy, startRaid, sweep,
};
