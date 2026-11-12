'use strict';
const { Events } = require('discord.js');
const { sweep } = require('../protection/raid');
const { expire } = require('../protection/botApproval');
const { maybeWarnHealth } = require('../protection/hierarchy');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Đã đăng nhập: ${client.user.tag} (${client.guilds.cache.size} server)`);

    // Chạy ngay một lần để mở khóa lockdown đã hết hạn trong lúc bot tắt, rồi lặp định kỳ.
    let running = false;
    const tick = async () => {
      if (running) return; // chống chồng chéo
      running = true;
      try {
        await sweep(client);
        await expire(client);
      } catch (err) {
        console.error('Lỗi sweep:', err);
      } finally {
        running = false;
      }
    };
    await tick();
    setInterval(tick, 30_000).unref();

    // Kiểm tra thứ bậc role và quyền ở mọi server, lần lượt để không dồn request (chỉ báo khi có lỗi)
    for (const guild of client.guilds.cache.values()) {
      await maybeWarnHealth(guild).catch((err) => console.warn(`Health check ${guild.name} lỗi:`, err.message));
    }
  },
};
