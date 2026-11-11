'use strict';
// Chống leo thang quyền: ai không phải owner/người tin cậy mà cấp quyền nguy hiểm cho role,
// hoặc cấp role có quyền nguy hiểm cho thành viên, đều bị cảnh báo (và hoàn tác ở chế độ act).
const { Events } = require('discord.js');
const { getConfig } = require('../config');
const { sendModLog } = require('../utils/log');
const { COLORS } = require('../utils/embed');
const { findExecutor, AuditLogEvent } = require('../protection/antiNuke');
const { DANGEROUS } = require('../protection/hierarchyCheck');
const { scheduleHealthCheck } = require('../protection/hierarchy');

const dangerousOf = (role) => DANGEROUS.filter((p) => role.permissions.has(p, false));

function isAllowed(guild, cfg, executor) {
  return (
    executor.id === guild.client.user.id ||
    executor.id === guild.ownerId ||
    cfg.trustedUserIds.includes(executor.id) ||
    cfg.trustedBotIds.includes(executor.id)
  );
}

module.exports = [
  {
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole) {
      const guild = newRole.guild;
      const cfg = getConfig(guild.id);
      if (!cfg.escalation.enabled) return;

      // Đổi thứ tự role có thể đẩy role bot xuống: kiểm tra lại sau khi yên 30 giây
      if (oldRole.position !== newRole.position) scheduleHealthCheck(guild);

      const gained = DANGEROUS.filter((p) => newRole.permissions.has(p, false) && !oldRole.permissions.has(p, false));
      if (!gained.length) return;

      const executor = await findExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id);
      if (executor && isAllowed(guild, cfg, executor)) return;

      let action = 'Chỉ ghi log';
      if (cfg.mode === 'act' && cfg.escalation.revert) {
        if (!executor) action = 'Không xác định người thực hiện, chỉ cảnh báo';
        else if (!newRole.editable) action = 'Role nằm trên bot, không hoàn tác được';
        else {
          const ok = await newRole.setPermissions(oldRole.permissions, 'Anti-escalation: hoàn tác quyền nguy hiểm').then(() => true, () => false);
          action = ok ? 'Đã hoàn tác quyền của role' : 'Hoàn tác thất bại';
        }
      }
      await sendModLog(guild, {
        title: '🔺 Role được cấp quyền nguy hiểm',
        description: `Role **${newRole.name}** được thêm: ${gained.join(', ')}`,
        user: executor ?? undefined,
        action,
        color: COLORS.danger,
        alert: true,
      });
    },
  },
  {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
      const guild = newMember.guild;
      const cfg = getConfig(guild.id);
      if (!cfg.escalation.enabled || oldMember.partial) return; // member chưa có trong cache thì không biết role cũ
      if (newMember.id === guild.client.user.id) return;

      const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id) && dangerousOf(r).length);
      if (!added.size) return;

      const executor = await findExecutor(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
      if (executor && isAllowed(guild, cfg, executor)) return;

      let action = 'Chỉ ghi log';
      if (cfg.mode === 'act' && cfg.escalation.revert) {
        if (!executor) action = 'Không xác định người thực hiện, chỉ cảnh báo';
        else {
          const removable = added.filter((r) => r.editable);
          const ok = removable.size
            ? await newMember.roles.remove([...removable.keys()], 'Anti-escalation: gỡ role quyền cao').then(() => true, () => false)
            : false;
          action = ok ? `Đã gỡ ${removable.size} role` : 'Không gỡ được (role nằm trên bot hoặc thiếu quyền)';
        }
      }
      await sendModLog(guild, {
        title: '🔺 Thành viên được cấp role quyền cao',
        description: `${newMember.user.tag} nhận: ${added.map((r) => `**${r.name}** (${dangerousOf(r).join(', ')})`).join('; ')}`,
        user: executor ?? undefined,
        action,
        color: COLORS.danger,
        alert: true,
      });
    },
  },
];
