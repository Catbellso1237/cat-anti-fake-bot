'use strict';
const { Events } = require('discord.js');
const { getConfig } = require('../config');
const { sendModLog } = require('../utils/log');
const { isExempt } = require('../protection/exempt');
const { checkSpam, INVITE_RE } = require('../protection/antiSpam');
const { trackMessage, isRaider } = require('../protection/raid');

const NEW_MEMBER_MS = 24 * 3_600_000;
const logThrottle = new Map(); // tránh log lặp ở chế độ log
setInterval(() => {
  const now = Date.now();
  for (const [k, t] of logThrottle) if (now - t > 60_000) logThrottle.delete(k);
}, 60_000).unref();

module.exports = {
  name: Events.MessageCreate,
  async execute(msg) {
    if (!msg.guild || msg.author.bot || !msg.member) return;
    const cfg = getConfig(msg.guild.id);
    if (isExempt(msg.member, cfg)) return;

    // Chỉ theo dõi tin của thành viên mới để có thể xóa khi raid (giữ bộ nhớ nhỏ)
    if (Date.now() - (msg.member.joinedTimestamp ?? 0) < NEW_MEMBER_MS) trackMessage(msg);

    const key = `${msg.guild.id}:${msg.author.id}`;
    const reasons = [];
    if (isRaider(msg.guild.id, msg.author.id)) reasons.push('Thành viên vào trong lúc raid');
    if (checkSpam(key, msg.content, cfg.spam)) reasons.push('Spam');
    if (msg.content && INVITE_RE.test(msg.content)) reasons.push('Link mời server');
    if (msg.mentions.users.size >= 5) reasons.push('Mention hàng loạt');
    if (!reasons.length) return;

    let action = 'Chỉ ghi log';
    if (cfg.mode === 'act') {
      await msg.delete().catch(() => {});
      if (msg.member.moderatable) {
        const ok = await msg.member.timeout(cfg.spam.timeoutMs, reasons.join(', ')).then(() => true, () => false);
        action = ok ? 'Xóa tin + timeout' : 'Xóa tin (timeout thất bại)';
      } else {
        action = 'Xóa tin (không đủ quyền timeout)';
      }
    }

    const last = logThrottle.get(key) ?? 0;
    if (Date.now() - last < 30_000) return;
    logThrottle.set(key, Date.now());
    await sendModLog(msg.guild, {
      title: 'Vi phạm chống spam',
      description: `Lý do: ${reasons.join(', ')}\nKênh: <#${msg.channelId}>`,
      user: msg.author,
      action,
    });
  },
};
