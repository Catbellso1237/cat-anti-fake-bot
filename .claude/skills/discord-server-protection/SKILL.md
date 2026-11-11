---
name: discord-server-protection
description: Xây hệ thống bảo vệ server Discord: chống raid, spam, bot giả, nuke, xác minh thành viên, AutoMod, log; hạn chế chặn nhầm.
---

# Discord Server Protection

Dùng khi người dùng muốn bot bảo vệ server mà họ quản lý: chống raid, chống spam, chặn bot giả hoặc tài khoản giả, chống phá server (nuke), xác minh thành viên. Chỉ làm phòng thủ. Mặc định viết bằng discord.js v14, có ghi chú cho discord.py.

## 1. Nguyên tắc thiết kế

1. **Nhiều lớp**: AutoMod gốc của Discord (lớp 1) → bot kiểm tra join, spam (lớp 2) → xác minh thủ công hoặc nút (lớp 3). Không lớp nào đủ một mình.
2. **Chế độ chỉ log trước**: mỗi luật có `mode: "log" | "act"`. Chạy `log` vài ngày, xem chặn nhầm ai, rồi mới bật `act`.
3. **Hành động nhẹ trước**: ưu tiên timeout hoặc cách ly (role Quarantine) thay vì ban ngay. Ban chỉ khi chắc chắn.
4. **Danh sách miễn trừ**: owner, admin, role tin cậy, bot được whitelist không bị luật xử lý.
5. **Mọi hành động đều ghi log** vào kênh mod-log bằng embed (ai, làm gì, lý do, luật nào kích hoạt).
6. **Cấu hình theo từng server**, lưu trong DB hoặc file JSON, chỉnh được bằng slash command (ngưỡng, thời gian, kênh log, role).
7. Không có hệ thống nào chặn 100%. Nói rõ điều này với người dùng, tránh hứa tuyệt đối.

## 2. Quyền và intents cần có

- Intents: `Guilds`, `GuildMembers` (đặc quyền), `GuildMessages`, `MessageContent` (đặc quyền, chỉ bật nếu cần đọc nội dung), `GuildModeration`.
- Quyền bot: `ModerateMembers` (timeout), `KickMembers`, `BanMembers`, `ManageRoles`, `ViewAuditLog`, `ManageMessages`, `SendMessages`, `EmbedLinks`.
- Role của bot phải **nằm trên** các role nó cần quản lý và trên thành viên cần xử lý. Sai thứ tự role là lỗi phổ biến nhất (`Missing Permissions`).

## 3. Lớp 1: AutoMod gốc của Discord

Dùng AutoMod native trước, tiết kiệm tài nguyên bot và không bị lỗi khi bot chết:

```js
const {
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  AutoModerationActionType,
} = require('discord.js');

await guild.autoModerationRules.create({
  name: 'Chặn spam mention',
  eventType: AutoModerationRuleEventType.MessageSend,
  triggerType: AutoModerationRuleTriggerType.MentionSpam,
  triggerMetadata: { mentionTotalLimit: 5 },
  actions: [{ type: AutoModerationActionType.BlockMessage }],
  enabled: true,
});
```

Cần quyền `ManageGuild`. Kiểm tra phiên bản thư viện trước khi dùng các trigger khác.

## 4. Chống raid (nhiều tài khoản vào cùng lúc)

```js
// src/protection/antiRaid.js
const joinLog = new Map(); // guildId -> mảng timestamp

function checkRaid(guildId, { maxJoins = 8, windowMs = 10_000 } = {}) {
  const now = Date.now();
  const arr = (joinLog.get(guildId) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  joinLog.set(guildId, arr);
  return arr.length >= maxJoins;
}

module.exports = { checkRaid };
```

```js
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) return; // bot xử lý ở mục 5
  const cfg = await getConfig(member.guild.id);
  const accountAgeMs = Date.now() - member.user.createdTimestamp;
  const tooNew = accountAgeMs < cfg.minAccountAgeMs;     // ví dụ 3 ngày
  const raid = checkRaid(member.guild.id, cfg.raid);

  if (!raid && !tooNew) return;
  if (cfg.mode === 'act') {
    await member.timeout(cfg.quarantineMs, 'Nghi ngờ raid hoặc tài khoản quá mới').catch(console.error);
  }
  await sendModLog(member.guild, {
    title: raid ? 'Nghi ngờ raid' : 'Tài khoản quá mới',
    user: member.user,
    action: cfg.mode === 'act' ? 'Timeout' : 'Chỉ ghi log',
  });
});
```

- Tín hiệu bổ sung: avatar mặc định, tên giống nhau hàng loạt, nhiều tài khoản tạo cùng khoảng thời gian.
- Khi phát hiện raid: tạm khóa kênh chào mừng, tăng mức xác minh của server (`guild.setVerificationLevel`), tạm tắt invite nếu phiên bản thư viện hỗ trợ `guild.disableInvites()`.
- Timeout tối đa 28 ngày.

## 5. Chặn bot giả và bot lạ

Tình huống: kẻ xấu thêm bot lạ vào server, hoặc bot giả mạo tên bot nổi tiếng.

```js
const { AuditLogEvent } = require('discord.js');

client.on(Events.GuildMemberAdd, async (member) => {
  if (!member.user.bot) return;
  const cfg = await getConfig(member.guild.id);
  if (cfg.trustedBotIds.includes(member.id)) return;

  await new Promise((r) => setTimeout(r, 1500)); // audit log có độ trễ
  const logs = await member.guild
    .fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 })
    .catch(() => null);
  const entry = logs?.entries.find(
    (e) => e.target?.id === member.id && Date.now() - e.createdTimestamp < 30_000,
  );
  const adderId = entry?.executor?.id;
  const trusted = adderId && (adderId === member.guild.ownerId || cfg.trustedUserIds.includes(adderId));

  if (!trusted) {
    if (cfg.mode === 'act') await member.kick('Bot không do người được tin cậy thêm').catch(console.error);
    await sendModLog(member.guild, { title: 'Bot lạ bị chặn', user: member.user, action: cfg.mode });
  }
});
```

Kiểm tra giả mạo tên: so sánh tên bot với tên staff và bot nổi tiếng bằng khoảng cách Levenshtein. Nếu gần giống mà ID khác danh sách tin cậy thì cảnh báo, không tự ban chỉ vì tên.

## 6. Chống spam (cửa sổ trượt)

```js
// src/protection/antiSpam.js
const buckets = new Map(); // `${guildId}:${userId}` -> { times, last, dupes }

function checkSpam(key, content, { max = 6, windowMs = 5000, maxDupes = 3 } = {}) {
  const now = Date.now();
  const b = buckets.get(key) ?? { times: [], last: '', dupes: 0 };
  b.times = b.times.filter((t) => now - t < windowMs);
  b.times.push(now);
  b.dupes = content && content === b.last ? b.dupes + 1 : 0;
  b.last = content;
  buckets.set(key, b);
  return b.times.length > max || b.dupes >= maxDupes;
}

// dọn bộ nhớ định kỳ
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (!b.times.length || now - b.times[b.times.length - 1] > 60_000) buckets.delete(k);
  }
}, 60_000).unref();

module.exports = { checkSpam };
```

```js
client.on(Events.MessageCreate, async (msg) => {
  if (!msg.guild || msg.author.bot || isExempt(msg.member)) return;
  const spam = checkSpam(`${msg.guild.id}:${msg.author.id}`, msg.content);
  const inviteLink = /discord\.gg\/|discord(app)?\.com\/invite\//i.test(msg.content);
  const mentionFlood = msg.mentions.users.size >= 5;
  if (!spam && !inviteLink && !mentionFlood) return;
  await msg.delete().catch(() => {});
  await msg.member.timeout(10 * 60_000, 'Spam').catch(() => {});
});
```

Xóa tin hàng loạt dùng `channel.bulkDelete(ids)` (tối đa 100 tin, mỗi tin dưới 14 ngày), không xóa từng tin trong vòng lặp.

## 7. Chống phá server (anti-nuke)

Theo dõi số kênh, role bị xóa và ban hàng loạt theo từng người thực hiện trong một khoảng thời gian:

```js
const actions = new Map(); // `${guildId}:${executorId}:${type}` -> mảng timestamp

function bump(key, windowMs = 10_000) {
  const now = Date.now();
  const arr = (actions.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  actions.set(key, arr);
  return arr.length;
}

client.on(Events.ChannelDelete, async (channel) => {
  const logs = await channel.guild
    .fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 })
    .catch(() => null);
  const entry = logs?.entries.first();
  if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
  const id = entry.executor.id;
  if (id === channel.guild.ownerId || id === client.user.id) return;
  if (bump(`${channel.guild.id}:${id}:chdel`) >= 3) {
    const m = await channel.guild.members.fetch(id).catch(() => null);
    await m?.roles.set([], 'Anti-nuke: xóa kênh hàng loạt').catch(console.error);
    await sendModLog(channel.guild, { title: 'Anti-nuke kích hoạt', user: entry.executor, action: 'Gỡ toàn bộ role' });
  }
});
```

Làm tương tự cho `RoleDelete`, `GuildBanAdd`, và cảnh báo khi role được cấp quyền `Administrator` đột ngột (`Events.GuildRoleUpdate`).

## 8. Xác minh thành viên

Cách đơn giản và ổn định: nút xác minh cấp role.

```js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('verify').setLabel('Xác minh').setStyle(ButtonStyle.Success),
);
await channel.send({ embeds: [embed], components: [row] });

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isButton() || i.customId !== 'verify') return;
  const cfg = await getConfig(i.guild.id);
  await i.member.roles.add(cfg.verifiedRoleId).catch(console.error);
  await i.reply({ content: 'Đã xác minh.', flags: MessageFlags.Ephemeral });
});
```

- Nút xác minh phải hoạt động sau khi bot khởi động lại: dùng `customId` cố định và xử lý trong `InteractionCreate`, đừng dùng collector.
- Mức mạnh hơn: câu hỏi ngẫu nhiên hoặc mã captcha tự sinh, giới hạn số lần thử, hết hạn sau vài phút, kick nếu không xác minh trong thời gian đặt.
- Với `flags: MessageFlags.Ephemeral` cần discord.js 14.17+. Bản cũ dùng `ephemeral: true`.

## 9. discord.py (ghi chú)

- Timeout: `await member.timeout(timedelta(minutes=10), reason="Spam")`.
- Tìm ai thêm bot: `async for entry in guild.audit_logs(limit=5, action=discord.AuditLogAction.bot_add)`.
- Sự kiện: `on_member_join`, `on_message`, `on_guild_channel_delete`. Cần `intents.members = True` và `intents.message_content = True` nếu đọc nội dung.

## 10. Lệnh quản trị cấu hình

Tạo slash command `/security` (chỉ người có `ManageGuild`) với các nhánh: `status`, `mode log|act`, `raid <số> <giây>`, `accountage <ngày>`, `logchannel`, `trust add|remove`. Lưu vào DB theo `guildId`, và đọc lại mỗi lần cần (hoặc cache có hạn).

## 11. Kiểm tra trước khi giao

- Mọi luật có `mode: log` mặc định.
- Owner, admin, role tin cậy được miễn trừ.
- Mọi `await` hành động nguy hiểm có `.catch` và không làm bot sập.
- Map theo dõi có dọn bộ nhớ định kỳ.
- Đã nêu rõ intents đặc quyền cần bật trong Developer Portal.
- Đã kiểm tra thứ tự role và quyền của bot.
- Không tự thêm luật ban tự động chỉ dựa trên một tín hiệu yếu.
