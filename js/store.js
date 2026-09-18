/* ==========================================================================
   AMIRA OPEN — Lưu trữ
   - localStorage luôn được dùng làm bộ nhớ đệm, nhờ vậy mất mạng vẫn ghi điểm được
   - Nếu TOURNAMENT.sync.endpoint có giá trị thì đồng bộ thêm qua Google Apps Script,
     lúc đó sheet là dữ liệu chuẩn và mọi thiết bị nhìn thấy cùng một bảng
   ========================================================================== */
var Store = (function () {
  'use strict';

  var KEY = 'amira-open:bracket:v1';
  var PENDING_KEY = 'amira-open:pending:v1';
  var MAX_PENDING = 200;
  var pending = [];
  var endpoint = '';
  var pollMs = 10000;
  var statusFn = null;
  var inflight = 0;

  function setStatus(state, detail) {
    if (statusFn) statusFn(state, detail);
  }

  /* ---------- Bộ nhớ đệm trong trình duyệt ---------- */

  function loadLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveLocal(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* chế độ riêng tư */ }
  }

  /* ---------- Hàng đợi ghi ----------
     Gửi hỏng (mất mạng, sheet bận) thì giữ lại để gửi tiếp, và lưu luôn xuống
     localStorage để đóng trang mở lại vẫn không mất. Chừng nào hàng đợi chưa
     rỗng thì không nhận dữ liệu từ sheet về, nếu không điểm vừa bấm sẽ bị xoá. */

  function loadPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch (e) { return []; }
  }
  function savePending() {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch (e) {}
  }

  /* ---------- Đồng bộ qua sheet ---------- */

  function enabled() { return !!endpoint; }
  function busy() { return inflight > 0; }
  function hasPending() { return pending.length > 0; }

  function post(payload) {
    return fetch(endpoint, {
      method: 'POST',
      /* text/plain để trình duyệt gửi thẳng, không kèm bước preflight OPTIONS —
         Apps Script không trả lời OPTIONS nên có preflight là hỏng. */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function get(cb) {
    if (!endpoint) return cb(null);
    setStatus('syncing');
    fetch(endpoint, { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) { setStatus('ok'); cb(res.state || {}); }
        else { setStatus('error', res && res.error); cb(null); }
      })
      .catch(function (err) { setStatus('error', String(err)); cb(null); });
  }

  /* Gửi lần lượt từng thay đổi đang chờ, dừng ngay khi có lỗi để giữ đúng thứ tự. */
  function flush(cb) {
    cb = cb || function () {};
    if (!endpoint || !pending.length) return cb(null);
    inflight++;
    setStatus('syncing');
    post(pending[0])
      .then(function (res) {
        inflight--;
        if (res && res.ok) {
          pending.shift();
          savePending();
          if (pending.length) return flush(cb);
          setStatus('ok');
          cb(res.state || {});
        } else {
          setStatus('error', res && res.error);
          cb(null);
        }
      })
      .catch(function (err) {
        inflight--;
        setStatus('error', String(err));
        cb(null);
      });
  }

  function send(payload, cb) {
    if (!endpoint) return cb && cb(null);
    pending.push(payload);
    if (pending.length > MAX_PENDING) pending.splice(0, pending.length - MAX_PENDING);
    savePending();
    flush(cb);
  }

  /* Hỏi lại sheet theo chu kỳ. Bỏ qua khi tab đang ẩn hoặc đang có lệnh ghi
     chưa xong, để không đè lên thay đổi người dùng vừa bấm. */
  function startPolling(onRemote) {
    if (!endpoint) return;
    var pull = function () {
      if (document.hidden || busy()) return;
      if (hasPending()) return flush(function (st) { if (st) onRemote(st); });
      get(function (st) { if (st) onRemote(st); });
    };
    setInterval(pull, pollMs);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) pull();
    });
    window.addEventListener('online', pull);
  }

  /* Mở trang: gửi nốt những gì còn tồn từ lần trước rồi mới lấy dữ liệu về */
  function start(onRemote) {
    if (!endpoint) return;
    if (hasPending()) flush(function (st) { onRemote(st || null); });
    else get(onRemote);
    startPolling(onRemote);
  }

  function init(tournament, onStatus) {
    var cfg = (tournament && tournament.sync) || {};
    endpoint = String(cfg.endpoint || '').trim();
    pollMs = Math.max(3, Number(cfg.pollSeconds) || 10) * 1000;
    statusFn = onStatus || null;
    pending = endpoint ? loadPending() : [];
  }

  return {
    init: init,
    enabled: enabled,
    hasPending: hasPending,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    get: get,
    send: send,
    start: start
  };
})();
