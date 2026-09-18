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
- Mặc định chạy **mỗi lần tải trang**. Đặt `TOURNAMENT.intro.showOnce = true`
  trong `js/data.js` nếu chỉ muốn chạy lần đầu trên mỗi trình duyệt.
  Bấm **Giới thiệu** trên thanh tiêu đề để xem lại bất cứ lúc nào.
- Máy đang bật chế độ "giảm chuyển động" của hệ điều hành sẽ vào thẳng trang chính.
- Ảnh nền là `assets/intro-bg.jpg`, được làm nhòe nhẹ và phủ tối để chữ nổi lên.
  Đổi ảnh thì thay file đó; muốn ảnh nét nguyên bản thì đặt `--bg-blur: 0px`
  trong khối `.intro` của `styles.css`.

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
- **Nút lệ phí ở góc màn hình**: có vệt sáng chạy vòng quanh viền và quầng sáng đập
  theo nhịp để người xem nhận ra là bấm được; rê chuột vào thì hiệu ứng gây chú ý tắt đi.
  Bấm vào mở popup mã VietQR để đóng lệ phí tham gia 50.000đ, kèm nút sao chép số tài khoản.
- **Lưu kết quả** vào `localStorage` của trình duyệt — tải lại trang không mất điểm.
  Nút `Đặt lại giải` ở thanh trên xoá toàn bộ.
- **Đồng bộ nhiều thiết bị qua Google Sheet** (tuỳ chọn, xem mục dưới).

## Ảnh khi chia sẻ link

Các thẻ `og:` và `twitter:` trong `<head>` của `index.html` quyết định ảnh và
dòng mô tả hiện ra khi dán link vào Facebook, Zalo, Messenger.

**Bắt buộc đổi tên miền** trong bốn thẻ có `https://…` (`canonical`, `og:url`,
`og:image`, `twitter:image`) cho khớp nơi trang được deploy. Trình quét link
không chạy JavaScript và không hiểu đường dẫn tương đối — sai tên miền là ảnh
không hiện.

Đổi ảnh thì thay `assets/og-image.jpg`, giữ đúng tỉ lệ 1200×630. Facebook và
Zalo có cache, sau khi đổi phải nhấn *Scrape Again* ở
[Sharing Debugger](https://developers.facebook.com/tools/debug/) thì mới thấy ảnh mới.

## Đồng bộ kết quả qua Google Sheet

Mặc định mỗi trình duyệt giữ một bảng kết quả riêng, hai người ở hai máy **không**
nhìn thấy điểm của nhau. Muốn cả giải chung một bảng thì nối trang với một Google Sheet.

Trang tĩnh không ghi thẳng vào Sheets được, nên cần một Apps Script đứng giữa:

```
Trang web  ──GET──▶  Apps Script  ──▶  Sheet
           ◀─JSON──  (chạy bằng quyền
           ──POST─▶   của chủ sheet)
```

### Cài đặt

1. Mở Google Sheet → **Tiện ích mở rộng → Apps Script**
2. Xoá code mẫu, dán toàn bộ `apps-script/Code.gs` vào
3. **Triển khai → Tuỳ chọn triển khai mới → Ứng dụng web**
   - Thực thi với tư cách: **Tôi**
   - Ai có quyền truy cập: **Bất kỳ ai**
4. Copy URL ứng dụng web, dán vào `js/data.js`:

```js
sync: {
  endpoint: 'https://script.google.com/macros/s/..../exec',
  pollSeconds: 10
}
```

Sheet **không cần công khai** — script chạy bằng quyền của chủ sheet. Script tự tạo
hai sheet con: `_state` giữ JSON (dữ liệu chuẩn) và `Kết quả` là bảng cho người đọc.

### Cách hoạt động

- Bấm ghi điểm là lưu ngay xuống máy và vẽ lại luôn, không phải chờ mạng.
- Thay đổi gửi lên sheet dưới dạng **patch từng trận**, không gửi cả bảng. Nhờ vậy
  hai người sửa hai trận khác nhau cùng lúc thì không ai đè kết quả của ai.
- Trang hỏi lại sheet mỗi `pollSeconds` giây (chỉ khi tab đang mở), nên máy khác
  thấy điểm mới sau tối đa chừng đó giây — **không tức thì**.
- Mất mạng vẫn ghi điểm được. Thay đổi nằm trong hàng đợi lưu ở `localStorage`,
  có mạng lại thì tự gửi tiếp; trong lúc đó trang không nhận dữ liệu từ sheet về
  để khỏi xoá mất điểm vừa bấm.
- Ô trạng thái trên thanh tiêu đề báo: *Đang đồng bộ… / Đã đồng bộ với sheet /
  Mất kết nối — đang lưu tạm trên máy*.

### Giới hạn cần biết

- **Ai mở được trang thì ghi được.** URL Apps Script nằm trong mã nguồn trang.
  Với giải nội bộ thì chấp nhận được; đây không phải cơ chế bảo mật.
- Apps Script có hạn mức thời gian chạy mỗi ngày. Một buổi giải với vài người xem,
  hỏi lại mỗi 10 giây thì thoải mái; đừng đặt `pollSeconds` quá nhỏ hoặc mở trang
  cả ngày trên nhiều máy.
- Bảng `Kết quả` được dựng từ dữ liệu của máy vừa ghi. Nếu hai người bấm cùng lúc,
  bảng cho người đọc có thể chậm một nhịp — `_state` thì luôn đúng, và lần ghi kế
  tiếp sẽ dựng lại bảng cho khớp.
- Danh sách người chơi, hạng, thể thức vẫn nằm trong `js/data.js`, đổi thì phải
  deploy lại trang.

## Cấu trúc

```
index.html                  khung trang + popup lệ phí
styles.css                  toàn bộ giao diện, gồm cả mốc thời gian của animation
js/logo.js                  logo SVG: createLogo('full' | 'mark' | 'icon')
js/data.js                  dữ liệu giải: người chơi, hạng, nhánh đấu, thông tin sự kiện, thanh toán
js/store.js                 lưu trữ: localStorage + đồng bộ tuỳ chọn qua Google Sheet
apps-script/Code.gs         code dán vào Apps Script của sheet
js/intro.js                 màn giới thiệu: dựng nội dung, nút bỏ qua / tạm dừng
js/app.js                   logic tính điểm, chấp ván, đi tiếp vòng trong, vẽ đường nối
assets/intro-bg.jpg         ảnh nền của màn giới thiệu
assets/og-image.jpg         ảnh hiện khi chia sẻ link (1200×630)
assets/logo.svg             logo đầy đủ: huy hiệu kèm chữ AMIRA / OPEN (poster, mạng xã hội)
assets/logo-mark.svg        chỉ huy hiệu, dùng trong màn giới thiệu
assets/favicon.svg          chỉ quả bi số 9 — favicon và logo thanh tiêu đề, vì ở cỡ nhỏ
                            huy hiệu trắng viền vàng bị chìm trên nền kem
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
- `TOURNAMENT.intro.showOnce` — `false` (mặc định) chạy animation mỗi lần tải trang,
  `true` thì chỉ chạy lần đầu trên mỗi trình duyệt.
- `TOURNAMENT.sync.endpoint` — URL Apps Script để đồng bộ nhiều máy. Để rỗng thì
  trang chạy hoàn toàn cục bộ.

Muốn ép thể thức riêng cho một trận, thêm `format` vào trận đó:

```js
{ id: 'qf1', a: { player: 'phuong' }, b: { player: 'nam' },
  format: { raceTo: 9, handicap: 3, receiver: 'b' } }
```

Đổi số lượng người chơi (ví dụ 16 người) thì thêm một vòng vào đầu `TOURNAMENT.rounds`
theo đúng mẫu trên — giao diện và đường nối tự dựng theo dữ liệu.
