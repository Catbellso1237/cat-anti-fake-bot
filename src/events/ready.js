'use strict';
const { Events } = require('discord.js');
const { sweep } = require('../protection/raid');

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
      } catch (err) {
        console.error('Lỗi sweep:', err);
      } finally {
        running = false;
      }
    };
    await tick();
    setInterval(tick, 30_000).unref();
  },
};
