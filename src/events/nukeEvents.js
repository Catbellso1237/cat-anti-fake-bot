'use strict';
// Gộp 3 sự kiện phá hoại vào một file; loader hỗ trợ file export mảng.
const { Events } = require('discord.js');
const { handleDestructive, AuditLogEvent } = require('../protection/antiNuke');

module.exports = [
  {
    name: Events.ChannelDelete,
    execute: (ch) => ch.guild && handleDestructive(ch.guild, AuditLogEvent.ChannelDelete, ch.id, 'Xóa kênh hàng loạt'),
  },
  {
    name: Events.GuildRoleDelete,
    execute: (role) => handleDestructive(role.guild, AuditLogEvent.RoleDelete, role.id, 'Xóa role hàng loạt'),
  },
  {
    name: Events.GuildBanAdd,
    execute: (ban) => handleDestructive(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id, 'Ban hàng loạt'),
  },
];
