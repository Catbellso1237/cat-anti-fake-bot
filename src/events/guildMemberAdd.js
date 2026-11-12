'use strict';
const { Events } = require('discord.js');
const { getConfig } = require('../config');
const { sendModLog } = require('../utils/log');
const { COLORS } = require('../utils/embed');
const { recordJoin, startRaid, isRaidActive, markRaider } = require('../protection/raid');
const { checkBotAdder, findImpersonation } = require('../protection/antiBot');
const { requestApproval } = require('../protection/botApproval');

async function quarantine(member, cfg, reason) {
  if (cfg.mode !== 'act') return 'Chỉ ghi log';
  if (!member.moderatable) return 'Không đủ quyền timeout (đặt role bot cao hơn)';
  const ok = await member.timeout(cfg.quarantineMs, reason).then(() => true, () => false);
  return ok ? 'Timeout' : 'Timeout thất bại';
}

async function handleBot(member, cfg) {
  const { trusted, adderId, unknown } = await checkBotAdder(member, cfg);
  const lookalike = await findImpersonation(member, cfg);
  if (trusted && !lookalike) return;

  // Bot lạ: hỏi chủ server có cho phép không (tạm gỡ quyền bot ở chế độ act) thay vì kick ngay
  if (cfg.botApproval.enabled && !trusted) return requestApproval(member, cfg, { adderId, lookalike });

  let action = 'Chỉ ghi log';
  if (cfg.mode === 'act' && !trusted && !unknown) {
    action = member.kickable
      ? await member.kick('Bot không do người được tin cậy thêm').then(() => 'Kick bot', () => 'Kick thất bại')
      : 'Không đủ quyền kick';
  }
  await sendModLog(member.guild, {
    title: lookalike ? '⚠️ Bot nghi giả mạo tên' : '🤖 Bot lạ bị chặn',
    description: lookalike
      ? `Tên gần giống **${lookalike.user.tag}** nhưng ID khác. Chỉ cảnh báo, không tự ban chỉ vì tên.`
      : `Được thêm bởi: ${adderId ? `<@${adderId}>` : 'không xác định (thiếu quyền View Audit Log hoặc audit log chưa có), nên chưa tự kick'}`,
    user: member.user,
    action,
    color: COLORS.warn,
    alert: !trusted,
  });
}

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const cfg = getConfig(member.guild.id);
    if (member.user.bot) return handleBot(member, cfg);

    const { raid, recentIds } = recordJoin(member.guild.id, cfg, member.id);

    let handledByRaidStart = false;
    if (raid) {
      const first = await startRaid(member.guild, cfg, {
        reason: `${recentIds.length} tài khoản vào trong ${Math.round(cfg.raid.windowMs / 1000)} giây.`,
        raiderIds: recentIds,
      });
      // Cách ly cả nhóm vừa vào trước khi ngưỡng bị chạm
      handledByRaidStart = first;
      if (first && cfg.mode === 'act') {
        for (const id of recentIds) {
          const m = await member.guild.members.fetch(id).catch(() => null);
          if (m) await quarantine(m, cfg, 'Raid');
        }
      }
    }

    if (isRaidActive(member.guild.id)) {
      markRaider(member.guild.id, member.id);
      if (!handledByRaidStart) await quarantine(member, cfg, 'Vào server trong lúc raid');
      return;
    }

    const ageMs = Date.now() - member.user.createdTimestamp;
    if (ageMs < cfg.minAccountAgeMs) {
      const action = await quarantine(member, cfg, 'Tài khoản quá mới');
      await sendModLog(member.guild, {
        title: 'Tài khoản quá mới',
        description: `Tạo cách đây ${Math.floor(ageMs / 3_600_000)} giờ.`,
        user: member.user,
        action,
      });
    }
  },
};
