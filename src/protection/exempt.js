'use strict';
const { PermissionFlagsBits } = require('discord.js');

// Owner, admin, người/bot tin cậy, role miễn trừ không bao giờ bị luật xử lý.
function isExempt(member, cfg) {
  if (!member) return false;
  if (member.id === member.guild.ownerId) return true;
  if (cfg.trustedUserIds.includes(member.id)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some((r) => cfg.exemptRoleIds.includes(r.id));
}

module.exports = { isExempt };
