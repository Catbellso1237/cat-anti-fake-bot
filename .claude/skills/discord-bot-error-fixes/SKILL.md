---
name: discord-bot-error-fixes
description: Chẩn đoán và sửa lỗi lặp khi tạo bot Discord (discord.js/discord.py): bảng mã lỗi, nguyên nhân, cách sửa, sổ ghi lỗi, quy tắc dừng retry.
---

# Discord Bot Error Fixes

Dùng khi bot Discord báo lỗi, lỗi quay lại sau khi sửa, hoặc cùng một lỗi bị sửa nhiều lần. Mục tiêu: tìm đúng nguyên nhân gốc, không sửa vòng vòng.

## 1. Quy trình bắt buộc

1. **Lấy nguyên văn lỗi**: thông báo đầy đủ, mã lỗi (ví dụ `50013`), stack trace, phiên bản thư viện, ngôn ngữ chạy. Không sửa khi chưa có các thông tin này.
2. **Tra bảng ở mục 3 hoặc 4** theo mã lỗi hoặc thông báo.
3. **Giả thuyết một dòng**: "Lỗi do X vì Y". Sửa đúng một thứ, chạy lại, ghi kết quả.
4. **Ghi vào sổ lỗi** (mục 2) trước khi thử lần tiếp theo.
5. **Quy tắc 2 lần**: cùng một lỗi sửa hai lần vẫn còn thì dừng, đổi hướng. Việc cần làm: kiểm tra phiên bản thư viện, intents, quyền, process chạy trùng, cấu hình, rồi đọc tài liệu chính thức. Không thử lần ba theo hướng cũ.
6. Không chạy được bot thật (thiếu token): nói rõ chưa kiểm chứng, chỉ kiểm tra cú pháp (`node --check file.js`, `python -m py_compile file.py`).

## 2. Sổ ghi lỗi (ERRORS.md)

Tạo `ERRORS.md` ở thư mục gốc project, thêm một mục mỗi lần thử:

```
## 2026-11-10 | Unknown interaction (10062) | /ping
- Thử 1: thêm try/catch quanh reply -> vẫn lỗi (không phải nguyên nhân)
- Thử 2: deferReply() ở đầu handler -> hết lỗi
- Nguyên nhân gốc: xử lý DB mất hơn 3 giây trước khi reply
- Bài học: command có truy vấn chậm luôn defer trước
```

Đọc lại `ERRORS.md` trước khi sửa lỗi mới để không lặp lại cách đã thất bại.

## 3. Bảng lỗi discord.js

| Lỗi / mã | Nguyên nhân thường gặp | Cách sửa |
|---|---|---|
| `Error [TokenInvalid]` | Token sai, thừa khoảng trắng, đã reset | Lấy token mới, kiểm tra `.env` được nạp (`dotenv`), không có dấu ngoặc kép thừa |
| `Used disallowed intents` (4014) | Dùng intent đặc quyền chưa bật | Bật `Server Members`/`Message Content` trong Developer Portal > Bot, hoặc bỏ intent không cần |
| `10062 Unknown interaction` | Reply quá 3 giây | `deferReply()` đầu handler, rồi `editReply` |
| `40060 Interaction has already been acknowledged` | Trả lời hai lần, hoặc hai process cùng chạy | Kiểm tra `replied`/`deferred`; tắt process thừa |
| `50013 Missing Permissions` | Role bot thấp hơn mục tiêu, thiếu quyền | Kéo role bot lên cao, cấp đúng quyền, kiểm tra quyền ghi đè của kênh |
| `50001 Missing Access` | Bot không thấy kênh hoặc server | Kiểm tra quyền `ViewChannel` của kênh, bot đã được mời vào server chưa |
| `50035 Invalid Form Body` | Embed vượt giới hạn, nội dung rỗng, URL ảnh sai | Cắt chuỗi theo giới hạn, không gửi tin rỗng, kiểm tra URL |
| `50007 Cannot send messages to this user` | Người dùng tắt DM | Bắt lỗi, báo trong kênh thay vì DM |
| `10008 Unknown Message` / `10003 Unknown Channel` | Đối tượng đã bị xóa | `.catch(() => null)` và bỏ qua |
| `Cannot read properties of undefined (reading 'send')` | Kênh/guild không có trong cache | `await client.channels.fetch(id)` thay vì `cache.get` |
| `ERR_REQUIRE_ESM` / `Cannot use import statement` | Trộn CommonJS và ESM | Thống nhất: `"type": "module"` + `import`, hoặc `require` thuần |
| `MaxListenersExceededWarning` | Đăng ký listener trong handler hoặc vòng lặp | Chỉ gọi `client.on` một lần ở cấp cao nhất |
| Command không hiện / bị nhân đôi | Đăng ký cả global lẫn guild, hoặc chưa deploy | Chỉ dùng một kiểu đăng ký; xóa bản cũ bằng cách `put` mảng rỗng |
| Bot trả lời hai lần mỗi lệnh | Hai process chạy cùng token (máy local + server) | Tắt process cũ, kiểm tra pm2/Docker còn chạy |
| `Shard 0's WebSocket was closed` lặp lại | Mạng, token sai, intent sai | Đọc mã đóng (4004 token sai, 4014 intent), không restart vô hạn |

## 4. Bảng lỗi discord.py

| Lỗi | Nguyên nhân thường gặp | Cách sửa |
|---|---|---|
| `PrivilegedIntentsRequired` | Bật intent đặc quyền trong code nhưng chưa bật ở Portal | Bật ở Developer Portal hoặc bỏ intent |
| `RuntimeWarning: coroutine ... was never awaited` | Thiếu `await` | Thêm `await` |
| `discord.errors.NotFound: 404 ... Unknown interaction` | Không phản hồi trong 3 giây | `await interaction.response.defer()` rồi `followup.send` |
| `InteractionResponded` | Gọi `response.send_message` hai lần | Lần sau dùng `followup.send` |
| Command bị rate limit khi sync | Gọi `tree.sync()` trong `on_ready` mỗi lần (`on_ready` có thể chạy nhiều lần) | Sync một lần trong `setup_hook`, hoặc bằng lệnh owner `!sync` |
| Bot đứng im, không phản hồi | Dùng `time.sleep`, hoặc code chặn event loop | `await asyncio.sleep`, đẩy việc nặng sang `asyncio.to_thread` |
| `Forbidden: 403 ... Missing Permissions` | Thiếu quyền hoặc role thấp | Giống discord.js |
| `ExtensionAlreadyLoaded` | Load cog hai lần | Load trong `setup_hook`, kiểm tra trước khi load lại |

## 5. Lỗi lặp do cấu trúc (hay bị bỏ sót)

- **Chạy trùng process**: nguyên nhân của phản hồi đôi, 40060, đăng nhập bị đá. Trước khi sửa code, kiểm tra process đang chạy (`ps`, `pm2 list`, `docker ps`).
- **Listener trong listener**: mỗi lần có sự kiện lại thêm một listener mới, sau đó phản hồi nhân lên. Đăng ký listener chỉ một lần.
- **Đăng ký lại command ở mỗi lần khởi động**: gây rate limit. Tách script `deploy-commands` riêng, chỉ chạy khi command thay đổi.
- **Restart vô hạn**: bot lỗi lúc khởi động rồi bị pm2/Docker bật lại liên tục, mỗi lần đăng nhập lại có thể bị Discord chặn tạm. Dùng giới hạn restart và backoff.
- **Sửa nhầm chỗ**: lỗi quyền mà sửa code, lỗi intent mà sửa logic. Quyền, intent, role, phiên bản luôn kiểm tra trước.

## 6. Chống vòng lặp thử lại trong code

Khởi động có backoff và dừng hẳn với lỗi không thể tự khỏi:

```js
const FATAL = new Set([4004, 4010, 4011, 4012, 4013, 4014]); // token, shard, intent sai

async function start() {
  let delay = 5_000;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await client.login(process.env.DISCORD_TOKEN);
      return;
    } catch (err) {
      console.error(`Đăng nhập lỗi (lần ${attempt}):`, err.message);
      if (err.code === 'TokenInvalid' || FATAL.has(err.code)) break; // không retry
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 60_000);
    }
  }
  console.error('Không đăng nhập được, dừng. Kiểm tra token và intents.');
  process.exit(1);
}
start();
```

Trong pm2 đặt `--max-restarts 10 --restart-delay 5000`. Trong Docker dùng `restart: on-failure:5`.

## 7. Cấu hình tránh lỗi ngay từ đầu

- Mỗi command bọc trong try/catch chung (xem handler ở skill discord-bot-dev), trả lời lỗi gọn gàng cho người dùng.
- Mọi gọi `fetch`, `send`, `delete`, `roles.add` đều có `.catch` ghi log, không để rejection lọt ra ngoài.
- Dùng `Events.X` thay chuỗi tên sự kiện để tránh gõ sai.
- Ghim phiên bản thư viện trong `package.json` / `requirements.txt` để tránh lỗi do cập nhật.
- Tách cấu hình (token, ID) ra `.env`, kiểm tra thiếu biến ngay khi khởi động:

```js
for (const k of ['DISCORD_TOKEN', 'CLIENT_ID']) {
  if (!process.env[k]) throw new Error(`Thiếu biến môi trường ${k}`);
}
```

## 8. Khi nào hỏi người dùng

Hỏi khi thiếu: lỗi nguyên văn, phiên bản thư viện, nơi bot chạy (local hay server), bot đã chạy ở nơi khác chưa. Không đoán khi một câu hỏi ngắn giải quyết được.
