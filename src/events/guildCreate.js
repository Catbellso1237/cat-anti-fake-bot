'use strict';
const { Events } = require('discord.js');
const { maybeWarnHealth } = require('../protection/hierarchy');

// Khi bot vào server mới: kiểm tra ngay thứ bậc role và quyền (chỉ báo khi có lỗi).
module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    await maybeWarnHealth(guild, { force: true });
  },
};
