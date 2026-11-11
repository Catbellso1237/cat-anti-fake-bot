---
name: coding-token-and-loop-guard
description: Khi code: tiết kiệm token (đọc ít, sửa nhỏ, output ngắn) và chặn lỗi lặp kể cả sau khi đã sửa (sổ lỗi, chốt chặn, giới hạn số lần thử).
---

# Coding Token and Loop Guard

Dùng cho mọi công việc code, đặc biệt khi sửa lỗi nhiều lần. Có hai mục tiêu: dùng ít token nhất có thể, và không để cùng một lỗi quay lại sau khi đã sửa. Không thể đảm bảo tuyệt đối cả hai, nhưng làm đúng các bước dưới đây sẽ giảm mạnh lãng phí và lỗi lặp.

## 1. Tiết kiệm token

1. **Đọc có chọn lọc**: tìm bằng Grep trước, rồi đọc đúng đoạn cần (Read với offset và limit). Không đọc cả file lớn, không đọc lại file vừa sửa.
2. **Sửa nhỏ**: dùng Edit để đổi đúng đoạn. Không viết lại cả file khi chỉ đổi vài dòng.
3. **Không in lại code trong câu trả lời**: file đã nằm trên đĩa. Chỉ nêu tên file và mô tả thay đổi trong 1-3 dòng. Chỉ trích đoạn code khi người dùng cần xem.
4. **Giới hạn output lệnh**: dùng `| tail -n 30`, `| head -n 50`, `--quiet`, `--silent`. Lấy đủ thông tin trong một lệnh thay vì nhiều lệnh nhỏ.
5. **Gộp thay đổi theo lô**: sửa nhiều chỗ liên quan rồi chạy kiểm tra một lần, trừ khi đang dò lỗi (xem mục 2, bước 4).
6. **Trả lời ngắn**: kết quả trước, giải thích sau và chỉ khi cần. Không nhắc lại yêu cầu, không tóm tắt từng bước đã làm.
7. **Hỏi một câu ngắn thay vì đoán rồi làm lại** khi thiếu thông tin quyết định (ngôn ngữ, phiên bản, nơi chạy).
8. **Không thử lại khi môi trường chặn** (không có mạng, thiếu quyền, thiếu gói). Báo ngay nguyên nhân và cách người dùng xử lý, rồi làm tiếp phần không bị chặn.
9. **Ngân sách thao tác**: nếu một tác vụ đã tốn hơn khoảng 15 lần gọi công cụ mà chưa có tiến triển, dừng lại, báo cáo ngắn và hỏi hướng đi.
10. Tác vụ nặng, đọc nhiều file: giao cho subagent chỉ trả về kết luận thay vì đọc tất cả trong cuộc trò chuyện chính.

## 2. Chống lỗi lặp, kể cả sau khi đã sửa

### Trước khi sửa

1. Đọc `ERRORS.md` (nếu có). Nếu lỗi khớp một mục cũ, áp dụng cách đã ghi và kiểm tra lại. Không đoán lại từ đầu.
2. Lấy nguyên văn lỗi và dòng gây lỗi. Tìm **nguyên nhân gốc**, không vá triệu chứng.
3. Viết giả thuyết một dòng: lỗi do X vì Y. Giả thuyết phải kiểm chứng được.

### Khi sửa

4. Mỗi lần chỉ đổi một thứ, rồi chạy lại đúng lệnh đã gây lỗi để biết thay đổi đó có tác dụng không.
5. Sửa xong phải **chứng minh đã hết lỗi**: chạy lại lệnh hoặc test gốc và đọc kết quả. Không tuyên bố đã sửa chỉ vì code trông đúng.
6. Nếu thay đổi không giúp ích hoặc không rõ tác dụng, hoàn tác (`git diff`, `git checkout -- file`, `git stash`) rồi thử hướng khác. Không để thay đổi vô ích chồng lên nhau.

### Sau khi sửa: đặt chốt chặn

7. Thêm ít nhất một chốt chặn để lỗi cùng loại không quay lại, chọn cái rẻ nhất phù hợp:
   - test tái hiện lỗi (ưu tiên số một),
   - kiểm tra biến môi trường hoặc cấu hình ngay khi khởi động,
   - assertion hoặc kiểm tra kiểu ở chỗ dễ sai,
   - lint rule hoặc kiểm tra cú pháp trong script `npm run check`,
   - ghi chú ngắn ngay tại chỗ dễ sai nếu không thể tự động hóa.
8. Ghi vào `ERRORS.md` (mẫu ở mục 4).

### Đã sửa rồi mà vẫn lỗi: kiểm tra theo thứ tự

1. Code mới có thực sự đang chạy không? Process cũ chưa tắt, chưa restart, build cũ, cache cũ, deploy chưa xong.
2. Có chạy trùng nhiều bản không (hai process, hai container, máy local và server)?
3. File đã sửa có đúng là file được nạp không (nhầm thư mục, nhầm nhánh, nhầm môi trường)?
4. Môi trường chạy có khác môi trường test không (phiên bản, biến môi trường, quyền)?
5. Dữ liệu cũ hoặc trạng thái đã lưu có còn gây lỗi không (DB, cache, file tạm)?
6. Sửa một chỗ có làm hỏng chỗ khác không (chạy toàn bộ test hoặc kiểm tra cú pháp toàn project, không chỉ file vừa sửa)?

## 3. Điều kiện dừng và báo cáo

Dừng, không thử tiếp, khi gặp một trong các trường hợp:
- Cùng một lỗi đã sửa 2 lần mà vẫn còn.
- 3 hướng khác nhau liên tiếp đều không có tiến triển.
- Cần thứ mình không có (token, quyền, mạng, file thật).

Báo cáo ngắn gọn gồm: lỗi là gì, đã thử gì (một dòng mỗi cách), điều nghi ngờ nhất, và cần người dùng cung cấp hoặc làm gì tiếp. Không lặp lại cách đã thất bại, không giả vờ đã kiểm chứng.

## 4. Mẫu ERRORS.md

Giữ file này ngắn: mỗi lỗi một mục, sửa mục cũ thay vì thêm mục trùng.

```
## Unknown interaction (10062) | /ping
- Triệu chứng: bot báo Interaction failed sau vài giây
- Nguyên nhân gốc: truy vấn DB mất hơn 3 giây trước khi reply
- Cách sửa: deferReply() ở đầu handler
- Đã thử nhưng vô ích: bọc try/catch quanh reply
- Chốt chặn: test /ping có DB chậm giả lập; ghi chú trong handler
- Cách kiểm tra: chạy /ping khi DB tạm chậm, không thấy lỗi
```

## 5. Checklist trước khi kết thúc

- [ ] Đã chạy lại đúng lệnh hoặc test gây lỗi và thấy hết lỗi.
- [ ] Có chốt chặn cho lỗi này, hoặc đã nêu lý do không thể có.
- [ ] `ERRORS.md` đã cập nhật.
- [ ] Không còn thay đổi thử nghiệm vô ích trong code.
- [ ] Câu trả lời cuối ngắn: đã sửa gì, đã kiểm tra thế nào, còn rủi ro gì.
