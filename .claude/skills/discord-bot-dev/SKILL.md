---
name: discord-bot-dev
description: Viết, sửa, gỡ lỗi bot Discord bằng discord.js (Node) hoặc discord.py: slash command, event, intents, bảo mật token, tránh lỗi lặp.
---

# Discord Bot Dev

Dùng skill này khi người dùng muốn tạo, sửa hoặc gỡ lỗi bot Discord. Tập trung vào code, không viết văn bản dài.

## 1. Chọn ngôn ngữ và thư viện

- Người dùng chưa nói rõ: hỏi một câu ngắn "JavaScript (discord.js) hay Python (discord.py)?". Không đoán.
- JavaScript: `discord.js` v14, Node 18+ (nên 20+).
- Python: `discord.py` 2.x, Python 3.9+.
- Luôn kiểm tra phiên bản đã cài (`npm ls discord.js` hoặc `pip show discord.py`) trước khi dùng API, vì API đổi giữa các bản.

## 2. Cấu trúc project

discord.js:

```
bot/
  src/
    index.js          # khởi tạo client, nạp command và event
    deploy-commands.js# đăng ký slash command
    commands/         # mỗi file một command
    events/           # mỗi file một event
  .env                # DISCORD_TOKEN, CLIENT_ID, GUILD_ID (không commit)
  .gitignore          # có .env và node_modules
  package.json
```

discord.py:

```
bot/
  main.py
  cogs/               # mỗi cog một nhóm command
  .env
  .gitignore
  requirements.txt
```

## 3. Khung code tối thiểu

### discord.js v14

```js
// src/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Events, Collection } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

client.once(Events.ClientReady, (c) => console.log(`Đã đăng nhập: ${c.user.tag}`));

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    const msg = { content: 'Có lỗi khi chạy lệnh.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

client.login(process.env.DISCORD_TOKEN);
```

Một command:

```js
// src/commands/ping.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Kiểm tra bot'),
  async execute(interaction) {
    await interaction.reply('Pong!');
  },
};
```

Đăng ký command (chạy riêng khi thêm hoặc đổi command):

```js
// src/deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = fs
  .readdirSync(path.join(__dirname, 'commands'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => require(`./commands/${f}`).data.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);
rest
  .put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands })
  .then(() => console.log('Đã đăng ký command'))
  .catch(console.error);
```

Khi dev dùng command theo guild (cập nhật ngay). Command toàn cầu (`Routes.applicationCommands`) có thể mất thời gian để hiện.

### discord.py 2.x

```python
# main.py
import os
import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"Đã đăng nhập: {bot.user}")

@bot.tree.command(name="ping", description="Kiểm tra bot")
async def ping(interaction: discord.Interaction):
    await interaction.response.send_message("Pong!")

bot.run(os.environ["DISCORD_TOKEN"])
```

## 4. Quy tắc quan trọng (nguồn lỗi hay gặp)

- **Intents**: chỉ bật intent cần dùng. `Guilds` đủ cho slash command. Đọc nội dung tin nhắn cần `MessageContent` (intent đặc quyền, phải bật trong Developer Portal > Bot). Đọc danh sách thành viên cần `GuildMembers` (cũng đặc quyền). Thiếu intent thì sự kiện không tới hoặc nội dung rỗng, đừng sửa logic trước khi kiểm tra intent.
- **Trả lời trong 3 giây**: nếu tác vụ lâu, gọi `interaction.deferReply()` (JS) hoặc `interaction.response.defer()` (Python) rồi mới `editReply` / `followup.send`. Lỗi "Unknown interaction" thường do quá 3 giây hoặc trả lời hai lần.
- **Không trả lời hai lần** cho cùng một interaction. Kiểm tra `replied` / `deferred`.
- **Quyền của bot**: lỗi `Missing Permissions` / `Missing Access` thường do role của bot thiếu quyền trong kênh. Kiểm tra quyền và thứ tự role trước khi đổi code.
- **Slash command không hiện**: kiểm tra đã chạy bước đăng ký chưa, `CLIENT_ID` và `GUILD_ID` đúng chưa, bot được mời với scope `applications.commands`.
- **Rate limit**: không gửi tin nhắn hàng loạt trong vòng lặp. Dùng thư viện xử lý sẵn, thêm độ trễ, gộp bằng embed.
- **Embed**: giới hạn 6000 ký tự tổng, mô tả 4096, tối đa 25 field. Tin nhắn thường tối đa 2000 ký tự.
- **Bất đồng bộ**: không dùng `time.sleep` trong discord.py (dùng `asyncio.sleep`). Không chặn event loop bằng tác vụ nặng, đẩy sang thread hoặc tiến trình khác.
- **Xử lý lỗi toàn cục**: luôn có try/catch trong handler và bắt `unhandledRejection` (JS) hoặc `on_app_command_error` (Python) để bot không chết im lặng.

## 5. Bảo mật

- Token chỉ nằm trong `.env` hoặc biến môi trường, không viết vào code, không in ra log, không commit.
- Thêm `.env` vào `.gitignore` ngay khi tạo project, tạo kèm `.env.example` không chứa giá trị thật.
- Nếu token đã lộ: yêu cầu người dùng vào Developer Portal > Bot > Reset Token ngay.
- Kiểm tra quyền người dùng trước lệnh nguy hiểm (kick, ban, xóa tin). Dùng `setDefaultMemberPermissions` (JS) hoặc `@app_commands.default_permissions` (Python), và kiểm tra lại phía server.
- Không đưa input người dùng thẳng vào lệnh shell, truy vấn SQL hay `eval`. Dùng truy vấn tham số hóa.
- Cấp cho bot quyền tối thiểu khi tạo link mời, tránh Administrator.

## 6. Tránh lỗi lặp và vòng thử lại (bắt buộc)

1. Trước khi sửa lỗi, đọc đúng thông báo lỗi và stack trace, xác định dòng gây lỗi. Không sửa theo phỏng đoán.
2. Ghi lại ngắn gọn các cách đã thử (một dòng mỗi cách) và kết quả. Không thử lại cách đã thất bại.
3. Sau **2 lần sửa thất bại** cho cùng một lỗi: dừng, đổi hướng (kiểm tra phiên bản thư viện, intents, quyền, cấu hình, đọc tài liệu chính thức) thay vì sửa tiếp theo hướng cũ.
4. Mỗi lần chỉ đổi một thứ, rồi chạy lại để biết thay đổi nào có tác dụng.
5. Nếu không chạy được bot thật (không có token), không giả vờ đã test. Nói rõ phần nào chưa kiểm chứng, chạy kiểm tra cú pháp (`node --check`, `python -m py_compile`) và để người dùng thử với token của họ.
6. Không tự thêm thư viện mới khi thư viện hiện có đã làm được. Khi cần cài gói mà mạng bị chặn, nói rõ gói nào bị thiếu thay vì thử lại nhiều lần.

## 7. Quy trình làm việc

1. Xác định: ngôn ngữ, bot làm gì, dùng slash command hay prefix command, có cần lưu dữ liệu không.
2. Dựng khung project theo mục 2, kèm `.gitignore` và `.env.example`.
3. Viết từng command nhỏ, mỗi command một file.
4. Kiểm tra cú pháp, rà lại intents và quyền cần thiết.
5. Hướng dẫn chạy: cài gói, điền `.env`, chạy bước đăng ký command, chạy bot.
6. Tóm tắt ngắn: đã làm gì, người dùng cần làm gì (bật intent, mời bot, điền token).

## 8. Khi người dùng muốn chạy bot 24/7

- Gợi ý chạy dưới `pm2` (Node), `systemd` hoặc Docker. Cần restart tự động khi lỗi.
- Ghi log ra file hoặc stdout, không ghi token.
- Không lưu dữ liệu quan trọng trong bộ nhớ tiến trình, dùng SQLite hoặc cơ sở dữ liệu khác.
