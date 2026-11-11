'use strict';
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, Options, Events } = require('discord.js');

if (!process.env.DISCORD_TOKEN) {
  console.error('Thiếu biến môi trường DISCORD_TOKEN. Sao chép .env.example thành .env và điền token.');
  process.exit(1);
}

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers, // đặc quyền: bật "Server Members Intent" trong Developer Portal
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildModeration, // sự kiện ban + audit log
];
if (process.env.USE_MESSAGE_CONTENT !== 'false') intents.push(GatewayIntentBits.MessageContent); // đặc quyền

const client = new Client({
  intents,
  // Giới hạn cache để bot không ngốn RAM khi server lớn
  makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 50, ReactionManager: 0 }),
  sweepers: { ...Options.DefaultSweeperSettings, messages: { interval: 3600, lifetime: 1800 } },
  allowedMentions: { parse: [] },
});

client.commands = new Collection();

// Nạp command: mỗi file một command
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter((f) => f.endsWith('.js'))) {
  const cmd = require(`./commands/${file}`);
  if (!cmd.data || !cmd.execute) {
    console.warn(`Bỏ qua commands/${file}: thiếu data hoặc execute`);
    continue;
  }
  client.commands.set(cmd.data.name, cmd);
}

// Nạp event: mỗi file export một event hoặc một mảng event. Đăng ký đúng một lần ở đây.
for (const file of fs.readdirSync(path.join(__dirname, 'events')).filter((f) => f.endsWith('.js'))) {
  const mod = require(`./events/${file}`);
  for (const ev of Array.isArray(mod) ? mod : [mod]) {
    const run = (...args) =>
      Promise.resolve(ev.execute(...args)).catch((err) => console.error(`Lỗi event ${ev.name}:`, err));
    if (ev.once) client.once(ev.name, run);
    else client.on(ev.name, run);
  }
}

client.on(Events.Error, (e) => console.error('client error:', e));
client.on(Events.Warn, (m) => console.warn('client warn:', m));
client.on(Events.ShardDisconnect, (ev, id) => console.warn(`Shard ${id} ngắt kết nối (mã ${ev.code})`));
client.rest.on('rateLimited', (info) => console.warn(`Rate limit ${info.route}, chờ ${info.timeToReset}ms`));

process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  process.exit(1); // để pm2/Docker khởi động lại ở trạng thái sạch
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`Nhận ${sig}, đang tắt...`);
    await client.destroy();
    process.exit(0);
  });
}

// Đăng nhập có backoff; dừng hẳn với lỗi không thể tự khỏi (token sai, thiếu intent).
const FATAL_CODES = new Set(['TokenInvalid', 'DisallowedIntents', 'TokenMissing']);
async function start() {
  let delay = 5_000;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await client.login(process.env.DISCORD_TOKEN);
      return;
    } catch (err) {
      console.error(`Đăng nhập lỗi (lần ${attempt}/5): ${err.message}`);
      if (FATAL_CODES.has(err.code)) break;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 60_000);
    }
  }
  console.error('Không đăng nhập được, dừng. Kiểm tra token và các intent đặc quyền trong Developer Portal.');
  process.exit(1);
}
start();
