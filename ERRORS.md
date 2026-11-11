# ERRORS.md

Sổ ghi lỗi đã gặp. Đọc trước khi sửa lỗi mới; mỗi lỗi một mục, sửa mục cũ thay vì thêm trùng.

## npm test: "Cannot find module '/…/tests'" (Node 22)
- Triệu chứng: `node --test tests/` báo MODULE_NOT_FOUND, 0 test chạy
- Nguyên nhân gốc: Node 22 hiểu `tests/` là đường dẫn module chứ không phải thư mục
- Cách sửa: `node --test tests/*.test.js` (đã sửa trong package.json)
- Đã thử nhưng vô ích: không có
- Chốt chặn: `npm test` nằm trong CI (`.github/workflows/ci.yml`)
- Cách kiểm tra: `npm test` báo 6 pass

## Chưa kiểm chứng với Discord thật
- Code Discord (events, commands, lockdown) mới được kiểm tra cú pháp; chưa chạy với token thật vì môi trường tạo bot không có mạng để cài discord.js.
- Việc cần làm khi chạy lần đầu: `npm install`, `npm run check`, điền `.env`, bật intent đặc quyền (Server Members, Message Content), `npm run deploy`, `npm start`, thử `/setup` rồi `/lockdown on` ở server thử.

## getConfig tạo object mới mỗi lần gọi (phát hiện khi review)
- Triệu chứng (tiềm ẩn): lệnh đổi cấu hình rồi lưu, nhưng thay đổi mất nếu một event gọi getConfig giữa chừng
- Nguyên nhân gốc: `getConfig` gộp với mặc định và gán object mới vào store ở mỗi lần gọi
- Cách sửa: chỉ gộp một lần cho mỗi server, các lần sau trả về đúng object đã lưu
- Đã thử nhưng vô ích: không có
- Chốt chặn: test "getConfig luôn trả về cùng một object" trong tests/core.test.js
- Cách kiểm tra: `npm test`

## Kick nhầm bot khi không đọc được audit log (phát hiện khi review)
- Nguyên nhân gốc: thiếu quyền View Audit Log làm `adderId` rỗng, bị coi là bot không tin cậy
- Cách sửa: không xác định được người thêm thì chỉ cảnh báo, không kick (`unknown`)
- Chốt chặn: ghi chú trong `checkBotAdder` và README (mục giới hạn đã biết)
