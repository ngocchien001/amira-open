# AMIRA OPEN — Bảng nhánh đấu billiards

Trang web tĩnh (HTML + CSS + JavaScript thuần, không framework, không build) hiển thị
nhánh đấu loại trực tiếp cho giải billiards 9 bi thể thức xếp cao.

## Chạy

Mở thẳng `index.html` bằng trình duyệt, hoặc chạy một web server tĩnh:

```bash
python3 -m http.server 8000
# rồi mở http://localhost:8000
```

## Tính năng

### Màn giới thiệu đầu trang

Lần đầu mở trang sẽ chạy một đoạn animation:

1. Logo xoay hai vòng và phóng to dần ở giữa màn hình (~2,4s).
2. Logo thu nhỏ và đẩy lên trên (~0,9s).
3. Nội dung giải đấu hiện lần lượt từng dòng: thể thức, thời gian, địa điểm,
   lệ phí, giải thưởng.
4. Giữ màn hình vài giây rồi tự ẩn để vào trang nhánh đấu.

- **Bỏ qua** (góc dưới bên phải, hoặc phím `Esc`) — tắt animation vào thẳng trang chính.
- **Tạm dừng / Tiếp tục** (hoặc phím `Space`) — dừng đúng khung hình đang chạy,
  kể cả thanh tiến trình.
- Mặc định chỉ chạy **một lần** trên mỗi trình duyệt (`TOURNAMENT.intro.showOnce`).
  Bấm **Giới thiệu** trên thanh tiêu đề để xem lại bất cứ lúc nào.
- Máy đang bật chế độ "giảm chuyển động" của hệ điều hành sẽ vào thẳng trang chính.

### Nhánh đấu

- **Nhánh đấu 3 vòng**: Tứ kết → Bán kết → Chung kết → ô Nhà vô địch, có đường nối giữa các trận.
- **Thể thức chạm N + chấp ván**: hiển thị dạng `8 bi · chấp 2` (chạm 8, người hạng thấp
  hơn được chấp trước 2 ván) hoặc `Chạm 7` khi hai bên cùng hạng.
- **Ghi điểm từng ván**: bấm `+` / `−` ở mỗi tay cơ. Điểm hiển thị đã cộng sẵn số ván được
  chấp, nên trận `8 bi · chấp 2` bắt đầu từ `0 – 2`. Ai chạm mốc trước thì thắng, trận tự khoá.
- **Chọn nhanh người thắng**: bấm nút `✓` để kết thúc trận ngay mà không cần đếm từng ván.
- **Tự động vào vòng trong**: thắng tứ kết thì lên bán kết, thắng bán kết thì vào chung kết.
  Thể thức của vòng sau được tính lại theo hạng của hai người vừa vào.
- **Sửa kết quả**: bấm `Đặt lại` trong một trận sẽ xoá luôn kết quả các vòng sau phụ thuộc vào nó.
- **Đánh dấu người trả tiền bàn**: người thua mỗi trận được gắn nhãn `trả tiền bàn`.
- **Nút lệ phí ở góc màn hình**: mở popup mã VietQR để đóng lệ phí tham gia 50.000đ,
  kèm nút sao chép số tài khoản.
- **Lưu kết quả** vào `localStorage` của trình duyệt — tải lại trang không mất điểm.
  Nút `Đặt lại giải` ở thanh trên xoá toàn bộ.

## Cấu trúc

```
index.html                  khung trang + popup lệ phí
styles.css                  toàn bộ giao diện, gồm cả mốc thời gian của animation
js/logo.js                  logo SVG (bản đầy đủ có vòng chữ, bản rút gọn cho thanh tiêu đề)
js/data.js                  dữ liệu giải: người chơi, hạng, nhánh đấu, thông tin sự kiện, thanh toán
js/intro.js                 màn giới thiệu: dựng nội dung, nút bỏ qua / tạm dừng
js/app.js                   logic tính điểm, chấp ván, đi tiếp vòng trong, vẽ đường nối
assets/logo.svg             logo đầy đủ (dùng cho poster, mạng xã hội)
assets/logo-mark.svg        logo rút gọn, dùng làm favicon
assets/qr-techcombank.png   mã VietQR nhận lệ phí
```

Toàn bộ mốc thời gian của animation nằm trong CSS (`.intro { --spin, --shift-at, --info-at,
--total ... }`), nên nút Tạm dừng chỉ cần đặt `animation-play-state: paused` là mọi thứ
dừng đúng chỗ — không có `setTimeout` nào phải đồng bộ thủ công.

## Sửa dữ liệu giải

Chỉ cần sửa `js/data.js`:

- `PLAYERS` — tên và hạng của từng tay cơ (`id` dùng để tham chiếu trong nhánh đấu).
- `RANKS` — thang hạng, đứng trước là mạnh hơn (mặc định `A` → `I`).
- `FORMAT_RULE` — luật suy ra thể thức: cùng hạng thì chạm 7, lệch hạng thì chạm 8 và
  mỗi bậc chênh lệch được chấp 1 ván.
- `TOURNAMENT.rounds` — các vòng và cặp đấu. Một vị trí là `{ player: 'id' }` (vòng đầu)
  hoặc `{ from: 'matchId' }` (người thắng trận trước).
- `TOURNAMENT.payment` — thông tin nhận lệ phí và đường dẫn ảnh QR.
- `TOURNAMENT.event` — thể thức, thời gian, địa điểm hiển thị trong màn giới thiệu.
- `TOURNAMENT.prizes` — danh sách giải thưởng (thêm bớt bao nhiêu dòng cũng được).
- `TOURNAMENT.intro.showOnce` — `false` nếu muốn animation chạy lại mỗi lần tải trang.

Muốn ép thể thức riêng cho một trận, thêm `format` vào trận đó:

```js
{ id: 'qf1', a: { player: 'phuong' }, b: { player: 'nam' },
  format: { raceTo: 9, handicap: 3, receiver: 'b' } }
```

Đổi số lượng người chơi (ví dụ 16 người) thì thêm một vòng vào đầu `TOURNAMENT.rounds`
theo đúng mẫu trên — giao diện và đường nối tự dựng theo dữ liệu.
