# Cat Anti Fake Bot

Bot Discord bảo vệ server của bạn: chống raid, bot giả, spam và phá server (nuke). Khi phát hiện raid bot tự lockdown chat, xóa tin của nhóm raid và gửi cảnh báo qua webhook.

> Không có hệ thống nào chặn được 100% tấn công. Hãy chạy ở chế độ `log` vài ngày trước khi bật `act`.

## Tính năng

| Nhóm | Chức năng |
|---|---|
| Chống raid | Đếm số người vào theo cửa sổ thời gian, đánh dấu tài khoản quá mới, timeout cả nhóm raid |
| Tự phản ứng khi raid | Tự khóa gửi tin ở mọi kênh chat, tăng mức xác minh server, xóa tin nhắn của người vào lúc raid, tự mở khóa khi hết hạn (kể cả sau khi bot restart) |
| Webhook raid | Cảnh báo raid, lockdown, anti-nuke gửi về webhook Discord |
| Duyệt bot mới | Bot lạ vào server thì bị tạm gỡ quyền (chế độ act) và chủ server phải xác nhận **cho phép** (chấp nhận rủi ro) hoặc **từ chối** (kick). Không phản hồi trong 10 phút thì tự kick |
| Bot giả | Cảnh báo bot có tên gần giống bot hoặc staff tin cậy |
| Chống spam | Spam tốc độ, lặp nội dung, link mời, mention hàng loạt |
| Anti-nuke | Xóa kênh/role hoặc ban hàng loạt: tự gỡ role người thực hiện |
| Thứ bậc role (kiểu Wick) | Kiểm tra role của bot có ở trên cùng không, role nào nằm trên bot có quyền nguy hiểm (Administrator, Manage Roles…), thiếu quyền, role xác minh/kênh log lỗi. Tự kiểm tra khi bot khởi động, khi vào server mới và khi đổi thứ tự role |
| Chống leo thang quyền | Người không phải owner/tin cậy cấp quyền nguy hiểm cho role, hoặc cấp role quyền cao cho thành viên: cảnh báo, và tự hoàn tác ở chế độ act |
| Dọn chat | `/purge` xóa tin, xóa tin raider, reset sạch một kênh |
| Xác minh | Nút xác minh cấp role, tạm dừng khi đang raid |
| Ổn định | Cooldown lệnh, giới hạn cache, dọn bộ nhớ, đăng nhập có backoff, tắt an toàn |

## Lệnh

| Lệnh | Quyền | Mô tả |
|---|---|---|
| `/setup` | Administrator | Tạo kênh `cat-mod-log` riêng tư và role `Verified` |
| `/security status` | Manage Server | Xem cấu hình |
| `/security mode log\|act` | Manage Server | Chỉ ghi log hoặc xử lý thật |
| `/security raid` | Manage Server | Ngưỡng raid, auto lockdown, thời gian mở khóa, xóa tin raider |
| `/security accountage` | Manage Server | Tuổi tài khoản tối thiểu |
| `/security logchannel` | Manage Server | Đặt kênh mod-log |
| `/security webhook` / `webhook_test` | Manage Server | Đặt và thử webhook cảnh báo |
| `/security botapproval` | Manage Server | Bật/tắt duyệt bot mới và chỉnh thời gian hết hạn |
| `/security trust` | Manage Server | Thêm hoặc bỏ người/bot tin cậy |
| `/health` | Manage Server | Kiểm tra thứ bậc role, quyền của bot và lỗi cấu hình |
| `/security escalation` | Manage Server | Bật/tắt chống leo thang quyền và tự hoàn tác |
| `/lockdown on\|off\|status` | Manage Server | Khóa hoặc mở khóa chat thủ công |
| `/purge messages` | Manage Messages | Xóa tối đa 100 tin gần nhất (lọc theo người) |
| `/purge raiders` | Manage Messages | Xóa tin của những người vào lúc raid |
| `/purge reset_channel` | Manage Messages + Manage Channels | Nhân bản kênh rồi xóa kênh cũ (không hoàn tác) |
| `/panel control` | Manage Server | Mở bảng điều khiển bảo mật (nút và menu, chỉ bạn thấy) |
| `/panel verify` | Manage Server | Đăng nút xác minh vào kênh hiện tại |
| `/ping` | Mọi người | Kiểm tra bot |

## Cài đặt

1. Tạo ứng dụng ở Discord Developer Portal, lấy `Token` và `Application ID`.
2. Mục **Bot** bật **Server Members Intent** và **Message Content Intent** (nếu đặt `USE_MESSAGE_CONTENT=false` thì không cần Message Content).
3. Mời bot bằng scope `bot` + `applications.commands` với các quyền: Manage Channels, Manage Roles, Moderate Members, Kick Members, View Audit Log, Manage Messages, Send Messages, Embed Links. Tránh cấp Administrator.
4. Cài và chạy:

```bash
npm install
cp .env.example .env     # điền DISCORD_TOKEN, CLIENT_ID, GUILD_ID (khi dev)
npm run deploy           # đăng ký slash command
npm start
```

5. Trong server: kéo **role của bot lên trên cùng** (chỉ dưới role của chủ server nếu có; sai thứ tự role gây lỗi `Missing Permissions`), rồi chạy `/health` để bot tự kiểm tra, sau đó `/setup`, `/security webhook`, `/panel verify` (nếu dùng xác minh) và `/panel control` để điều khiển.
6. Chạy `/security mode log` vài ngày, xem mod-log có chặn nhầm không, rồi `/security mode act`.

## Cách bot phản ứng khi raid (chế độ act)

1. Số người vào đạt ngưỡng (mặc định 8 người trong 10 giây).
2. Cách ly (timeout) cả nhóm vừa vào, đánh dấu họ là raider.
3. Khóa gửi tin và thêm reaction ở mọi kênh chat (lưu quyền cũ để khôi phục), tăng mức xác minh lên High.
4. Xóa tin nhắn đã ghi nhận của nhóm raid và xóa ngay tin mới của họ.
5. Gửi embed cảnh báo về kênh mod-log và webhook.
6. Sau thời gian đặt (mặc định 10 phút) hoặc khi `/lockdown off`: mở khóa, khôi phục quyền và mức xác minh.

## Chạy 24/7

```bash
pm2 start src/index.js --name cat-anti-fake-bot --max-restarts 10 --restart-delay 5000
```

Dữ liệu cấu hình nằm ở `data/config.json` (không commit). Sao lưu file này nếu cần.

## Phát triển

- `npm run check`: kiểm tra cú pháp và nạp thử module
- `npm test`: test các hàm thuần (webhook, anti-spam, config)
- Cấu hình Claude Code cho project nằm trong `CLAUDE.md` và `.claude/`; lỗi đã gặp ghi ở `ERRORS.md`.

## Bảng điều khiển (`/panel control`)

Một tin nhắn riêng tư với các nút, bấm là có tác dụng ngay và tự cập nhật số liệu:

| Điều khiển | Tác dụng |
|---|---|
| Chế độ: log/act | Chuyển giữa chỉ ghi log và xử lý thật |
| Duyệt bot | Bật/tắt yêu cầu duyệt bot mới |
| Khóa chat / Mở khóa chat | Lockdown thủ công, mở khóa khôi phục đúng quyền cũ |
| Tự khóa | Bật/tắt tự lockdown khi phát hiện raid |
| Chống leo thang | Bật/tắt chống cấp quyền nguy hiểm trái phép |
| Menu mức nhạy | Thấp (12 người/10s), Vừa (8/10s), Cao (5/10s), Rất cao (3/8s) |
| Kiểm tra quyền | Chạy `/health` và hiện kết quả |
| Thử webhook | Gửi một cảnh báo thử |
| Xóa tin raider | Xóa tin đã ghi nhận của nhóm raid |
| Làm mới | Cập nhật số liệu |

Mỗi lần bấm bot kiểm tra lại quyền **Manage Server** của người bấm (và Manage Messages với nút xóa tin). Nếu bot khởi động lại, bảng cũ vẫn dùng được; chỉ cần bấm "Làm mới". Cấu hình chi tiết hơn (webhook, kênh log, tin cậy) vẫn dùng `/security`.

## Duyệt bot mới

Khi một bot không có trong danh sách tin cậy được thêm vào server bởi người khác chủ server và người tin cậy (hoặc không xác định được người thêm):

1. Chế độ **act**: bot bảo vệ tạm gỡ toàn bộ quyền của bot mới (lưu quyền gốc). Chế độ **log**: chỉ hỏi, không hạn chế.
2. Bot gửi yêu cầu vào kênh mod-log (nếu không có thì nhắn riêng chủ server) kèm tên bot, người thêm, quyền yêu cầu và quyền nguy hiểm.
3. Chủ server hoặc người trong `/security trust` bấm:
   - **Từ chối và kick**: bot bị kick.
   - **Cho phép**: hiện cảnh báo lần cuối, bấm **Tôi hiểu rủi ro, cho phép** là **chấp nhận mọi hậu quả**: bot được khôi phục quyền gốc và vào danh sách tin cậy, từ đó không bị chặn hay giám sát bởi anti-nuke nữa.
4. Không ai phản hồi sau thời gian đặt (mặc định 10 phút): chế độ act sẽ kick bot, chế độ log chỉ ghi nhận. Yêu cầu được lưu nên vẫn xử lý đúng sau khi bot khởi động lại.

Bot do chủ server hoặc người tin cậy thêm vào được bỏ qua bước này. Tối đa 10 yêu cầu chờ cùng lúc để chống bị spam bot. Nếu không muốn dùng: `/security botapproval enabled:false`.

## Thứ bậc role và chống leo thang quyền

- Discord chỉ cho bot xử lý (timeout, kick, gỡ role) những thành viên có role **thấp hơn** role cao nhất của bot. Vì vậy role bot nên nằm trên cùng. `/health` liệt kê các role đang nằm trên bot, nhất là role có quyền nguy hiểm.
- Quyền được coi là nguy hiểm: Administrator, Manage Server, Manage Roles, Manage Channels, Manage Webhooks, Ban Members, Kick Members.
- Chống leo thang chỉ cho phép **chủ server, bot, và người trong `/security trust`** cấp các quyền hoặc role này. Người khác (kể cả admin khác) cấp thì bị cảnh báo; ở chế độ act bot hoàn tác nếu role không nằm trên bot. Nếu bạn có admin hợp lệ cần cấp quyền, thêm họ bằng `/security trust` hoặc tắt bằng `/security escalation enabled:false`.
- Không có người chơi nào "cao hơn" chủ server: nếu tài khoản chủ bị chiếm, bot không chặn được. Hãy bật 2FA cho chủ server và các admin.

## Giới hạn đã biết

- Số thành viên mỗi role trong `/health` tính theo cache; server trên 1.500 thành viên có thể thiếu.
- Phát hiện người thêm bot dựa vào audit log (có độ trễ nhỏ). Nếu không xác định được, bot vẫn hỏi duyệt thay vì kick ngay.
- Tạm gỡ quyền chỉ làm được khi role của bot mới nằm dưới role bot bảo vệ (một lý do nữa để đặt role bot bảo vệ trên cùng).
- Bot chỉ khóa được kênh khi role của nó có Manage Channels và đứng trên các role liên quan.
- `/purge messages` không xóa hàng loạt được tin quá 14 ngày (giới hạn của Discord).
