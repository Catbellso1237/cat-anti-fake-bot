# Cat Anti Fake Bot

Bot Discord bảo vệ máy chủ của bạn: chống tấn công ồ ạt (raid), bot giả, spam và phá máy chủ (nuke). Khi phát hiện raid, bot tự khóa chat, xóa tin nhắn của nhóm tấn công và gửi cảnh báo qua webhook.

> Không có hệ thống nào chặn được 100% tấn công. Hãy chạy ở chế độ `log` (chỉ ghi nhật ký) vài ngày trước khi bật chế độ `act` (xử lý thật).

## Tính năng

| Nhóm | Chức năng |
|---|---|
| Chống raid | Đếm số người vào theo cửa sổ thời gian, đánh dấu tài khoản quá mới, cách ly (timeout) cả nhóm tấn công |
| Tự phản ứng khi raid | Tự khóa gửi tin ở mọi kênh chat, tăng mức xác minh máy chủ, xóa tin nhắn của người vào lúc raid, tự mở khóa khi hết hạn (kể cả sau khi bot khởi động lại) |
| Webhook cảnh báo | Cảnh báo raid, khóa chat, phá máy chủ gửi về webhook Discord |
| Duyệt bot mới | Bot lạ vào máy chủ bị tạm gỡ quyền (chế độ act), chủ máy chủ phải xác nhận **cho phép** (chấp nhận rủi ro) hoặc **từ chối** (đuổi bot). Không phản hồi trong 10 phút thì tự đuổi |
| Bot giả | Cảnh báo bot có tên gần giống bot hoặc thành viên quản trị tin cậy |
| Chống spam | Spam tốc độ, lặp nội dung, link mời, nhắc tên hàng loạt |
| Chống phá máy chủ | Xóa kênh/role hoặc cấm hàng loạt: tự gỡ role của người thực hiện |
| Thứ bậc role (kiểu Wick) | Kiểm tra role của bot có nằm trên cùng không, role nào nằm trên bot có quyền nguy hiểm (Quản trị viên, Quản lý role…), thiếu quyền, role xác minh hoặc kênh nhật ký bị lỗi. Tự kiểm tra khi bot khởi động, khi vào máy chủ mới và khi đổi thứ tự role |
| Chống leo thang quyền | Người không phải chủ máy chủ hoặc người tin cậy mà cấp quyền nguy hiểm cho role, hoặc cấp role quyền cao cho thành viên: bot cảnh báo và tự hoàn tác ở chế độ act |
| Dọn chat | `/purge` xóa tin nhắn, xóa tin của nhóm tấn công, làm sạch hoàn toàn một kênh |
| Xác minh | Nút xác minh để cấp role, tạm dừng khi đang raid |
| Ổn định | Giới hạn tần suất dùng lệnh, giới hạn bộ nhớ đệm, dọn bộ nhớ định kỳ, đăng nhập có thử lại giãn cách, tắt an toàn |

## Lệnh

| Lệnh | Quyền cần có | Mô tả |
|---|---|---|
| `/setup` | Quản trị viên | Tạo kênh riêng tư `cat-mod-log` và role `Verified` |
| `/security status` | Quản lý máy chủ | Xem cấu hình hiện tại |
| `/security mode log\|act` | Quản lý máy chủ | Chỉ ghi nhật ký hoặc xử lý thật |
| `/security raid` | Quản lý máy chủ | Ngưỡng raid, tự khóa chat, thời gian mở khóa, xóa tin của nhóm tấn công |
| `/security accountage` | Quản lý máy chủ | Tuổi tài khoản tối thiểu |
| `/security logchannel` | Quản lý máy chủ | Đặt kênh nhật ký quản trị |
| `/security webhook` / `webhook_test` | Quản lý máy chủ | Đặt và thử webhook cảnh báo |
| `/security botapproval` | Quản lý máy chủ | Bật/tắt duyệt bot mới và chỉnh thời gian hết hạn |
| `/security escalation` | Quản lý máy chủ | Bật/tắt chống leo thang quyền và tự hoàn tác |
| `/security trust` | Quản lý máy chủ | Thêm hoặc bỏ người/bot tin cậy |
| `/health` | Quản lý máy chủ | Kiểm tra thứ bậc role, quyền của bot và lỗi cấu hình |
| `/lockdown on\|off\|status` | Quản lý máy chủ | Khóa hoặc mở khóa chat thủ công |
| `/purge messages` | Quản lý tin nhắn | Xóa tối đa 100 tin gần nhất (có thể lọc theo người) |
| `/purge raiders` | Quản lý tin nhắn | Xóa tin của những người vào lúc raid |
| `/purge reset_channel` | Quản lý tin nhắn + Quản lý kênh | Nhân bản kênh rồi xóa kênh cũ (không hoàn tác được) |
| `/panel control` | Quản lý máy chủ | Mở bảng điều khiển bảo mật (nút và menu, chỉ bạn thấy) |
| `/panel verify` | Quản lý máy chủ | Đăng nút xác minh vào kênh hiện tại |
| `/ping` | Mọi người | Kiểm tra bot còn sống |

## Cài đặt

1. Tạo ứng dụng ở Discord Developer Portal, lấy `Token` và `Application ID`.
2. Ở mục **Bot**, bật **Server Members Intent** (quyền xem danh sách thành viên) và **Message Content Intent** (quyền đọc nội dung tin nhắn). Nếu đặt `USE_MESSAGE_CONTENT=false` thì không cần bật Message Content Intent.
3. Mời bot bằng phạm vi `bot` + `applications.commands` với các quyền: Quản lý kênh, Quản lý role, Cách ly thành viên (timeout), Đuổi thành viên, Xem nhật ký kiểm tra (audit log), Quản lý tin nhắn, Gửi tin nhắn, Nhúng liên kết. Không nên cấp quyền Quản trị viên.
4. Cài đặt và chạy:

```bash
npm install
cp .env.example .env     # điền DISCORD_TOKEN, CLIENT_ID, GUILD_ID (khi phát triển)
npm run deploy           # đăng ký lệnh slash
npm start
```

5. Trong máy chủ: kéo **role của bot lên trên cùng** (chỉ nằm dưới role của chủ máy chủ nếu có; sai thứ tự role sẽ gây lỗi `Missing Permissions`). Sau đó chạy `/health` để bot tự kiểm tra, rồi `/setup`, `/security webhook`, `/panel verify` (nếu dùng xác minh) và `/panel control` để điều khiển.
6. Chạy `/security mode log` vài ngày, xem kênh nhật ký có chặn nhầm không, rồi mới chuyển sang `/security mode act`.

## Cách bot phản ứng khi bị raid (chế độ act)

1. Số người vào đạt ngưỡng (mặc định 8 người trong 10 giây).
2. Cách ly (timeout) cả nhóm vừa vào và đánh dấu họ là kẻ tấn công.
3. Khóa gửi tin và thêm biểu cảm ở mọi kênh chat (lưu quyền cũ để khôi phục), tăng mức xác minh lên Cao.
4. Xóa tin nhắn đã ghi nhận của nhóm tấn công và xóa ngay tin mới của họ.
5. Gửi thông báo cảnh báo về kênh nhật ký quản trị và webhook.
6. Sau thời gian đã đặt (mặc định 10 phút) hoặc khi dùng `/lockdown off`: mở khóa, khôi phục quyền và mức xác minh.

## Chạy 24/7

```bash
pm2 start src/index.js --name cat-anti-fake-bot --max-restarts 10 --restart-delay 5000
```

Dữ liệu cấu hình nằm ở `data/config.json` (không đưa lên git). Hãy sao lưu tệp này nếu cần.

## Phát triển

- `npm run check`: kiểm tra cú pháp và nạp thử các module
- `npm test`: chạy kiểm thử các hàm thuần (webhook, chống spam, cấu hình, thứ bậc role, bảng điều khiển, duyệt bot)

## Bảng điều khiển (`/panel control`)

Một tin nhắn riêng tư có các nút, bấm là có tác dụng ngay và tự cập nhật số liệu:

| Điều khiển | Tác dụng |
|---|---|
| Chế độ: log/act | Chuyển giữa chỉ ghi nhật ký và xử lý thật |
| Duyệt bot | Bật/tắt yêu cầu duyệt bot mới |
| Khóa chat / Mở khóa chat | Khóa thủ công; mở khóa sẽ khôi phục đúng quyền cũ |
| Tự khóa | Bật/tắt tự khóa chat khi phát hiện raid |
| Chống leo thang | Bật/tắt chặn cấp quyền nguy hiểm trái phép |
| Menu mức nhạy | Thấp (12 người/10 giây), Vừa (8/10 giây), Cao (5/10 giây), Rất cao (3/8 giây) |
| Kiểm tra quyền | Chạy `/health` và hiện kết quả |
| Thử webhook | Gửi một cảnh báo thử |
| Xóa tin raider | Xóa tin đã ghi nhận của nhóm tấn công |
| Làm mới | Cập nhật số liệu |

Mỗi lần bấm, bot kiểm tra lại quyền **Quản lý máy chủ** của người bấm (và Quản lý tin nhắn với nút xóa tin). Nếu bot khởi động lại, bảng cũ vẫn dùng được; chỉ cần bấm "Làm mới". Cấu hình chi tiết hơn (webhook, kênh nhật ký, danh sách tin cậy) vẫn dùng `/security`.

## Duyệt bot mới

Khi một bot không nằm trong danh sách tin cậy được thêm vào máy chủ bởi người không phải chủ máy chủ hay người tin cậy (hoặc không xác định được người thêm):

1. Chế độ **act**: bot bảo vệ tạm gỡ toàn bộ quyền của bot mới (lưu lại quyền gốc). Chế độ **log**: chỉ hỏi, không hạn chế.
2. Bot gửi yêu cầu vào kênh nhật ký quản trị (nếu không có thì nhắn riêng cho chủ máy chủ) kèm tên bot, người thêm, quyền bot yêu cầu và các quyền nguy hiểm.
3. Chủ máy chủ hoặc người trong danh sách `/security trust` bấm:
   - **Từ chối và đuổi**: bot bị đuổi khỏi máy chủ.
   - **Cho phép**: hiện cảnh báo lần cuối, bấm **Tôi hiểu rủi ro, cho phép** nghĩa là **chấp nhận mọi hậu quả**: bot được khôi phục quyền gốc và vào danh sách tin cậy, từ đó không bị chặn hay giám sát bởi chống phá máy chủ nữa.
4. Không ai phản hồi sau thời gian đã đặt (mặc định 10 phút): chế độ act sẽ đuổi bot, chế độ log chỉ ghi nhận. Yêu cầu được lưu lại nên vẫn xử lý đúng sau khi bot khởi động lại.

Bot do chủ máy chủ hoặc người tin cậy thêm vào sẽ được bỏ qua bước này. Tối đa 10 yêu cầu chờ cùng lúc để chống bị spam bot. Nếu không muốn dùng: `/security botapproval enabled:false`.

## Thứ bậc role và chống leo thang quyền

- Discord chỉ cho bot xử lý (cách ly, đuổi, gỡ role) những thành viên có role **thấp hơn** role cao nhất của bot. Vì vậy role của bot nên nằm trên cùng. `/health` liệt kê các role đang nằm trên bot, nhất là role có quyền nguy hiểm.
- Các quyền được coi là nguy hiểm: Quản trị viên, Quản lý máy chủ, Quản lý role, Quản lý kênh, Quản lý webhook, Cấm thành viên, Đuổi thành viên.
- Chống leo thang chỉ cho phép **chủ máy chủ, bot và người trong `/security trust`** cấp các quyền hoặc role này. Người khác (kể cả quản trị viên khác) cấp thì bị cảnh báo; ở chế độ act, bot sẽ hoàn tác nếu role đó không nằm trên bot. Nếu có quản trị viên hợp lệ cần cấp quyền, hãy thêm họ bằng `/security trust` hoặc tắt tính năng bằng `/security escalation enabled:false`.
- Không ai có quyền cao hơn chủ máy chủ: nếu tài khoản chủ bị chiếm, bot không chặn được. Hãy bật xác thực hai lớp (2FA) cho chủ máy chủ và các quản trị viên.

## Giới hạn đã biết

- Số thành viên mỗi role trong `/health` tính theo bộ nhớ đệm; máy chủ trên 1.500 thành viên có thể bị thiếu.
- Việc phát hiện người thêm bot dựa vào nhật ký kiểm tra (audit log) nên có độ trễ nhỏ. Nếu không xác định được, bot vẫn hỏi duyệt thay vì đuổi ngay.
- Tạm gỡ quyền chỉ làm được khi role của bot mới nằm dưới role của bot bảo vệ (thêm một lý do để đặt role bot bảo vệ ở trên cùng).
- Bot chỉ khóa được kênh khi role của nó có quyền Quản lý kênh và đứng trên các role liên quan.
- `/purge messages` không xóa hàng loạt được tin quá 14 ngày (giới hạn của Discord).
