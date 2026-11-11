---
name: discord-bot-stability
description: Làm bot Discord chạy ổn định khi tải cao: rate limit, hàng đợi, cooldown, shard, bộ nhớ, thời gian/múi giờ, embed và component nâng cao.
---

# Discord Bot Stability

Dùng khi bot chạy chậm, treo, bị rate limit, tốn RAM, lỗi khi nhiều người dùng cùng lúc, hoặc cần chỉnh thời gian và embed nâng cao. Lưu ý: không thể triệt tiêu 100% lỗi khi chạy quá tải. Mục tiêu là giảm lỗi, giữ bot sống và lỗi nào xảy ra cũng bị khoanh vùng, ghi log, tự phục hồi.

## 1. Rate limit

- discord.js tự xếp hàng request REST. Đừng tự `Promise.all` hàng trăm lệnh gửi cùng lúc.
- Theo dõi: `client.rest.on('rateLimited', (info) => console.warn('Rate limit', info.route, info.timeToReset));`
- Giới hạn toàn cục khoảng 50 request/giây mỗi bot.
- Việc nên làm: gộp nhiều dòng vào một embed, dùng `channel.bulkDelete(ids)` (tối đa 100 tin dưới 14 ngày) thay vì xóa từng tin, không sửa tin nhắn liên tục (ví dụ cập nhật bộ đếm mỗi giây). Với cập nhật tiến độ, sửa tối đa vài giây một lần.
- Không dùng vòng lặp `while(true)` gọi API. Dùng `setInterval` có khoảng cách hợp lý và có chống chồng chéo (chạy xong lần trước mới lên lịch lần sau).

## 2. Hàng đợi và cooldown

Hàng đợi giới hạn số tác vụ nặng chạy song song (không cần cài gói):

```js
class TaskQueue {
  #running = 0;
  #queue = [];
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
  }
  add(fn) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ fn, resolve, reject });
      this.#next();
    });
  }
  #next() {
    while (this.#running < this.concurrency && this.#queue.length) {
      const { fn, resolve, reject } = this.#queue.shift();
      this.#running++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          this.#running--;
          this.#next();
        });
    }
  }
}

const heavyQueue = new TaskQueue(2);
// await heavyQueue.add(() => taoAnhBangXepHang(data));
```

Cooldown theo người dùng và theo lệnh:

```js
const cooldowns = new Map();

function onCooldown(userId, cmd, ms) {
  const key = `${cmd}:${userId}`;
  const now = Date.now();
  const until = cooldowns.get(key) ?? 0;
  if (now < until) return Math.ceil((until - now) / 1000); // số giây còn lại
  cooldowns.set(key, now + ms);
  setTimeout(() => cooldowns.delete(key), ms).unref();
  return 0;
}

// trong handler:
const wait = onCooldown(interaction.user.id, interaction.commandName, 5000);
if (wait) return interaction.reply({ content: `Chờ ${wait}s nữa.`, flags: MessageFlags.Ephemeral });
```

Cooldown nên chỉnh được: đặt trong cấu hình theo từng lệnh (ví dụ `command.cooldownSeconds ?? 3`).

## 3. Bộ nhớ và cache

discord.js lưu cache mọi thứ theo mặc định, bot lớn sẽ ngốn RAM:

```js
const { Client, GatewayIntentBits, Options } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 50,
    ReactionManager: 0,
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: { interval: 3600, lifetime: 1800 }, // giây
  },
});
```

- discord.py: `commands.Bot(..., max_messages=100, member_cache_flags=discord.MemberCacheFlags.none(), chunk_guilds_at_startup=False)`.
- Dọn mọi `Map` tự tạo (cooldown, spam, session) bằng `setInterval(...).unref()` hoặc TTL. Map không bao giờ xóa là nguyên nhân rò rỉ bộ nhớ phổ biến nhất.
- Không lưu dữ liệu quan trọng trong RAM. Dùng SQLite hoặc DB khác.
- Theo dõi: `process.memoryUsage().heapUsed` ghi log mỗi vài phút để thấy xu hướng tăng.

## 4. Shard khi bot lớn

- Bắt buộc dùng shard khi bot vào khoảng 2500 server. Trước đó nếu RAM cao hoặc độ trễ lớn cũng nên cân nhắc.
- discord.js: `ShardingManager` với file entry (`bot.js`), `totalShards: 'auto'`. Mỗi shard là một process, nên dữ liệu chung phải dùng DB hoặc `broadcastEval`, không dùng biến toàn cục.
- discord.py: dùng `commands.AutoShardedBot`.

## 5. Timeout, defer và tác vụ lâu

- Interaction phải được phản hồi trong 3 giây, sau đó token còn hiệu lực 15 phút cho `editReply`/`followUp`. Tác vụ lâu hơn 15 phút: gửi tin nhắn thường vào kênh thay vì sửa interaction.
- Gọi HTTP ngoài luôn có timeout:

```js
const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
```

- Truy vấn DB và API chậm đặt sau `deferReply()`.

## 6. Lỗi toàn cục và tắt an toàn

```js
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  process.exit(1); // để pm2/systemd/Docker khởi động lại ở trạng thái sạch
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`Nhận ${sig}, đang tắt...`);
    await client.destroy();
    // đóng DB, ghi nốt dữ liệu đang chờ ở đây
    process.exit(0);
  });
}

client.on(Events.Error, (e) => console.error('client error:', e));
client.on(Events.ShardDisconnect, (ev, id) => console.warn(`Shard ${id} ngắt kết nối`, ev.code));
```

- discord.py: bắt lỗi lệnh bằng `@bot.tree.error` (hoặc `on_app_command_error`), và dùng `async with bot:` + `await bot.start(token)` để tắt gọn.
- Thêm kiểm tra sức khỏe (health check) đơn giản nếu chạy trong Docker.

## 7. Thời gian

### Hiển thị bằng timestamp của Discord (tự đổi theo múi giờ người xem)

```js
const { time, TimestampStyles } = require('discord.js');

const hetHan = new Date(Date.now() + 10 * 60_000);
time(hetHan, TimestampStyles.RelativeTime); // "trong 10 phút"
time(hetHan, TimestampStyles.LongDateTime); // ngày giờ đầy đủ
// dạng thô: `<t:${Math.floor(hetHan.getTime() / 1000)}:R>`
```

### Nhập thời lượng do người dùng chỉnh (10m, 2h, 1d)

```js
const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

function parseDuration(text) {
  const m = /^(\d+)\s*([smhd])$/i.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) * UNITS[m[2].toLowerCase()];
}
// parseDuration('10m') -> 600000, sai định dạng -> null (báo lại cho người dùng)
```

### Quy tắc thời gian quan trọng

- `setTimeout` tối đa khoảng 24,8 ngày (2^31-1 ms). Giá trị lớn hơn sẽ chạy ngay lập tức. Với lịch dài hơn, lưu mốc thời gian vào DB và kiểm tra bằng một `setInterval` mỗi 30-60 giây.
- Lịch hẹn, nhắc nhở, mute hết hạn phải **lưu DB** và nạp lại khi bot khởi động, nếu không bot restart là mất.
- Lưu thời gian dạng UTC (timestamp mili giây). Chỉ đổi sang múi giờ khi hiển thị. Cần múi giờ cố định: `new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })`. Python dùng `zoneinfo.ZoneInfo('Asia/Ho_Chi_Minh')`.
- Timeout thành viên tối đa 28 ngày.
- Lịch lặp theo giờ cố định (hằng ngày 8 giờ): dùng `node-cron` có `timezone` rõ ràng, hoặc `discord.ext.tasks` với `time=` trong Python.
- Cho phép chỉnh theo server: cooldown, thời gian timeout, thời gian hết hạn của nút/collector, múi giờ, lưu trong cấu hình từng guild.

## 8. Embed nâng cao

### Giới hạn (vượt là lỗi 50035)

| Mục | Tối đa |
|---|---|
| Title | 256 ký tự |
| Description | 4096 ký tự |
| Số field | 25 |
| Field name | 256 ký tự |
| Field value | 1024 ký tự |
| Footer text | 2048 ký tự |
| Author name | 256 ký tự |
| Tổng ký tự cả embed | 6000 |
| Số embed mỗi tin | 10 |
| Tin nhắn thường | 2000 ký tự |

### Hàm tạo embed an toàn

```js
const { EmbedBuilder } = require('discord.js');

const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function safeEmbed({ title, description, fields = [], color = 0x5865f2, footer }) {
  const e = new EmbedBuilder().setColor(color).setTimestamp();
  if (title) e.setTitle(cut(title, 256));
  if (description) e.setDescription(cut(description, 4096));
  if (footer) e.setFooter({ text: cut(footer, 2048) });
  for (const f of fields.slice(0, 25)) {
    e.addFields({
      name: cut(f.name || '-', 256),
      value: cut(f.value || '-', 1024),
      inline: Boolean(f.inline),
    });
  }
  return e;
}
```

### Ảnh đính kèm trong embed

```js
const { AttachmentBuilder } = require('discord.js');

const file = new AttachmentBuilder('./assets/banner.png', { name: 'banner.png' });
const embed = safeEmbed({ title: 'Bảng xếp hạng' }).setImage('attachment://banner.png');
await interaction.reply({ embeds: [embed], files: [file] });
```

### Phân trang bằng nút

```js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

async function paginate(interaction, pages, { time = 120_000 } = {}) {
  let i = 0;
  const row = (disabled = false) =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel('◀').setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || i === 0),
      new ButtonBuilder().setCustomId('next').setLabel('▶').setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || i === pages.length - 1),
    );

  await interaction.reply({ embeds: [pages[i]], components: [row()] });
  const msg = await interaction.fetchReply();

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (b) => b.user.id === interaction.user.id,
    time,
  });
  collector.on('collect', async (b) => {
    i += b.customId === 'next' ? 1 : -1;
    await b.update({ embeds: [pages[i]], components: [row()] });
  });
  collector.on('end', () => interaction.editReply({ components: [row(true)] }).catch(() => {}));
}
```

- Người bấm không phải chủ lệnh sẽ bị lọc bởi `filter`. Thêm `b.reply` ephemeral nếu muốn báo "không phải của bạn".
- Khi hết `time`, nút bị vô hiệu hóa. Với nút cần sống lâu (xác minh, vai trò), không dùng collector mà xử lý trong `InteractionCreate` bằng `customId` cố định.
- Select menu: `StringSelectMenuBuilder` (tối đa 25 lựa chọn). Modal: `ModalBuilder` + `TextInputBuilder`, hiển thị bằng `interaction.showModal(modal)` và phải gọi trong 3 giây.
- discord.js bản mới có Components V2 (container, section, v.v.). Chỉ dùng khi đã kiểm tra phiên bản thư viện hỗ trợ, và lưu ý không dùng chung với `content`/`embeds`.

### discord.py

```python
import discord

class Pager(discord.ui.View):
    def __init__(self, pages, author_id):
        super().__init__(timeout=120)
        self.pages, self.i, self.author_id = pages, 0, author_id
        self.message = None

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        return interaction.user.id == self.author_id

    @discord.ui.button(label="◀", style=discord.ButtonStyle.secondary)
    async def prev(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.i = max(0, self.i - 1)
        await interaction.response.edit_message(embed=self.pages[self.i], view=self)

    @discord.ui.button(label="▶", style=discord.ButtonStyle.secondary)
    async def next(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.i = min(len(self.pages) - 1, self.i + 1)
        await interaction.response.edit_message(embed=self.pages[self.i], view=self)

    async def on_timeout(self):
        for child in self.children:
            child.disabled = True
        if self.message:
            await self.message.edit(view=self)

# dùng:
# view = Pager(pages, interaction.user.id)
# await interaction.response.send_message(embed=pages[0], view=view)
# view.message = await interaction.original_response()
```

## 9. Checklist trước khi giao bot chạy thật

- [ ] Có xử lý `unhandledRejection`, `uncaughtException`, tắt an toàn.
- [ ] Mọi lệnh chậm đều `defer` trước, mọi HTTP ngoài có timeout.
- [ ] Có cooldown theo lệnh, tác vụ nặng đi qua hàng đợi.
- [ ] Giới hạn cache và dọn `Map` tự tạo.
- [ ] Nhắc nhở, mute, lịch hẹn nằm trong DB và được nạp lại khi khởi động.
- [ ] Embed đi qua hàm cắt theo giới hạn.
- [ ] Nút sống lâu dùng `customId` cố định, không dùng collector.
- [ ] Giới hạn số lần restart, log có timestamp, không ghi token.
- [ ] Đã nêu rõ rủi ro còn lại (rate limit, gián đoạn Discord) với người dùng, không hứa không còn lỗi.
