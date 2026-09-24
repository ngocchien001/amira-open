/**
 * AMIRA OPEN — lưu kết quả giải + dự đoán vào Google Sheet.
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
 * Dữ liệu tách theo "kênh" (tham số `channel` trên mỗi request), mỗi kênh có
 * một sheet dữ liệu chuẩn (JSON) và một sheet bảng cho người đọc:
 *   bracket  (mặc định) - kết quả trận đấu   -> _state  / Kết quả
 *   predict                - dự đoán vui       -> _predict / Dự đoán
 */

var CHANNELS = {
  bracket: { stateSheet: '_state', boardSheet: 'Kết quả' },
  predict: { stateSheet: '_predict', boardSheet: 'Dự đoán' }
};

function channelOf(name) {
  return CHANNELS[name] || CHANNELS.bracket;
}

/* ---------- Điểm vào ---------- */

function doGet(e) {
  var ch = channelOf(e && e.parameter && e.parameter.channel);
  return respond({ ok: true, state: readState(ch), updatedAt: readUpdatedAt(ch) });
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
    var ch = channelOf(body.channel);
    var state = readState(ch);

    if (body.replaceAll) {
      /* Đặt lại toàn bộ dữ liệu của kênh này */
      state = body.state || {};
    } else {
      /* Gộp thay đổi vào dữ liệu đang có, nhờ vậy hai người sửa hai trận
         (hoặc hai dự đoán) khác nhau cùng lúc không ghi đè kết quả của nhau. */
      (body.clear || []).forEach(function (id) { delete state[id]; });
      var set = body.set || {};
      Object.keys(set).forEach(function (id) { state[id] = set[id]; });
    }

    writeState(ch, state);
    if (body.board) writeBoard(ch, body.board);

    return respond({ ok: true, state: state, updatedAt: readUpdatedAt(ch) });
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

function readState(ch) {
  var raw = sheetNamed(ch.stateSheet).getRange('A2').getValue();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (err) { return {}; }
}

function readUpdatedAt(ch) {
  return String(sheetNamed(ch.stateSheet).getRange('B2').getValue() || '');
}

function writeState(ch, state) {
  var sh = sheetNamed(ch.stateSheet);
  sh.getRange('A1:B1').setValues([['state (JSON — đừng sửa tay)', 'Cập nhật lúc']]);
  sh.getRange('A2').setValue(JSON.stringify(state));
  sh.getRange('B2').setValue(new Date().toISOString());
}

function writeBoard(ch, rows) {
  if (!rows || !rows.length) return;
  var sh = sheetNamed(ch.boardSheet);
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
