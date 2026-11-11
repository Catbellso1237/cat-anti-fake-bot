'use strict';
// Chạy riêng khi thêm hoặc đổi command (không chạy mỗi lần khởi động để tránh rate limit).
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

for (const k of ['DISCORD_TOKEN', 'CLIENT_ID']) {
  if (!process.env[k]) {
    console.error(`Thiếu biến môi trường ${k}`);
    process.exit(1);
  }
}

const dir = path.join(__dirname, 'commands');
const body = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => require(path.join(dir, f)).data.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);
const { CLIENT_ID, GUILD_ID } = process.env;
// Có GUILD_ID: cập nhật ngay trong server đó. Không có: đăng ký toàn cầu (có thể mất thời gian để hiện).
const route = GUILD_ID ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) : Routes.applicationCommands(CLIENT_ID);

rest
  .put(route, { body })
  .then(() => console.log(`Đã đăng ký ${body.length} command (${GUILD_ID ? `server ${GUILD_ID}` : 'toàn cầu'})`))
  .catch((err) => {
    console.error('Đăng ký command lỗi:', err.message);
    process.exit(1);
  });
