# Cat Anti Fake Bot

Bot Discord (discord.js v14, Node 20+, CommonJS) bảo vệ server: chống raid, bot giả, spam, nuke; tự lockdown khi raid; cảnh báo qua webhook.

## Lệnh chính
- `npm install`: cài gói
- `npm run check`: kiểm tra cú pháp mọi file (và nạp thử command/event khi đã cài discord.js)
- `npm test`: chạy test (`node --test`, không cần token)
- `npm run deploy`: đăng ký slash command (chỉ chạy khi command đổi)
- `npm start`: chạy bot

## Cấu trúc
- `src/commands/`: mỗi file một slash command (`data`, `execute`, tùy chọn `cooldownSeconds`)
- `src/events/`: mỗi file một event, hoặc mảng event; được đăng ký đúng một lần trong `src/index.js`
- `src/protection/`: logic phát hiện và phản ứng (raid, antiSpam, antiBot, antiNuke, exempt, hierarchy). `hierarchyCheck.js` là logic thuần, có test; `hierarchy.js` lấy dữ liệu từ guild
- `src/panel/`: bảng điều khiển (`controlPanel.js` nút/select với customId tiền tố `panel:`, `presets.js` logic thuần có test)
- `src/utils/`: embed, thời gian, cooldown, webhook, mod-log
- `src/config.js`: cấu hình theo từng server, lưu `data/config.json`

## Quy tắc cứng
- Token và webhook URL không bao giờ vào code, log hay commit. Chỉ dùng `.env` hoặc `/security webhook`.
- Mọi luật có chế độ `log` mặc định; chỉ xử lý thật khi `mode = act`.
- Mọi hành động Discord nguy hiểm (timeout, kick, xóa, sửa quyền) phải có `.catch` hoặc kiểm tra `moderatable`/`manageable`.
- Embed đi qua `safeEmbed`. Lệnh chậm phải `deferReply` trước. Nút sống lâu dùng `customId` cố định, không dùng collector.
- Mọi `Map` theo dõi phải có dọn bộ nhớ định kỳ. Lịch hẹn (lockdown hết hạn) lưu trong config, không chỉ trong `setTimeout`.
- Không thêm thư viện mới khi thư viện hiện có làm được.

## Khi sửa lỗi
Đọc `ERRORS.md` trước. Mỗi lần đổi một thứ, chạy lại đúng lệnh gây lỗi. Sửa 2 lần không hết thì dừng và đổi hướng. Sau khi sửa phải thêm chốt chặn (test hoặc kiểm tra cấu hình) và ghi `ERRORS.md`. Chi tiết trong `.claude/skills/coding-token-and-loop-guard`.

## Skill của project
`.claude/skills/`: discord-bot-dev, discord-server-protection, discord-bot-error-fixes, discord-bot-stability, coding-token-and-loop-guard, code-review-specialist, doc-generator, refactor.
