/**
 * AMIRA OPEN — lưu kết quả giải vào Google Sheet.
 *
 * CÁCH CÀI (làm một lần, khoảng 3 phút):
 *   1. Mở Google Sheet  ->  Tiện ích mở rộng  ->  Apps Script
 *   2. Xoá hết code mẫu, dán toàn bộ file này vào
 *   3. Triển khai  ->  Tuỳ chọn triển khai mới  ->  Ứng dụng web
 *        - Thực thi với tư cách:  Tôi
 *        - Ai có quyền truy cập:  Bất kỳ ai
 *   4. Copy "URL ứng dụng web", dán vào TOURNAMENT.sync.endpoint trong js/data.js
 *
 * Sheet KHÔNG cần công khai: script chạy bằng quyền của chủ sheet.
 *
 * Script tạo và dùng hai sheet con:
 *   _state    - một ô JSON, đây mới là dữ liệu chuẩn để trang web đọc lại
 *   Kết quả   - bảng cho người đọc, tự dựng lại sau mỗi lần ghi
 */

var STATE_SHEET = '_state';
var BOARD_SHEET = 'Kết quả';

/* ---------- Điểm vào ---------- */

function doGet() {
  return respond({ ok: true, state: readState(), updatedAt: readUpdatedAt() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return respond({ ok: false, error: 'Sheet đang bận, thử lại sau' });
  }

  try {
    var body = JSON.parse(e.postData.contents);
    var state = readState();

    if (body.replaceAll) {
      /* Đặt lại toàn giải */
      state = body.state || {};
    } else {
      /* Gộp thay đổi vào dữ liệu đang có, nhờ vậy hai người sửa hai trận
         khác nhau cùng lúc không ghi đè kết quả của nhau. */
      (body.clear || []).forEach(function (id) { delete state[id]; });
      var set = body.set || {};
      Object.keys(set).forEach(function (id) { state[id] = set[id]; });
    }

    writeState(state);
    if (body.board) writeBoard(body.board);

    return respond({ ok: true, state: state, updatedAt: readUpdatedAt() });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Đọc / ghi ---------- */

function sheetNamed(name) {
  var ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function readState() {
  var raw = sheetNamed(STATE_SHEET).getRange('A2').getValue();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (err) { return {}; }
}

function readUpdatedAt() {
  return String(sheetNamed(STATE_SHEET).getRange('B2').getValue() || '');
}

function writeState(state) {
  var sh = sheetNamed(STATE_SHEET);
  sh.getRange('A1:B1').setValues([['state (JSON — đừng sửa tay)', 'Cập nhật lúc']]);
  sh.getRange('A2').setValue(JSON.stringify(state));
  sh.getRange('B2').setValue(new Date().toISOString());
}

function writeBoard(rows) {
  if (!rows || !rows.length) return;
  var sh = sheetNamed(BOARD_SHEET);
  sh.clear();

  var cols = rows[0].length;
  sh.getRange(1, 1, rows.length, cols).setValues(rows);
  sh.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#ffeedf');
  sh.setFrozenRows(1);
  for (var c = 1; c <= cols; c++) sh.autoResizeColumn(c);
}

/* ---------- Tiện ích ---------- */

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
