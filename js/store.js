/* ==========================================================================
   AMIRA OPEN — Lưu trữ
   - localStorage luôn được dùng làm bộ nhớ đệm, nhờ vậy mất mạng vẫn ghi điểm được
   - Nếu TOURNAMENT.sync.endpoint có giá trị thì đồng bộ thêm qua Google Apps Script,
     lúc đó sheet là dữ liệu chuẩn và mọi thiết bị nhìn thấy cùng một bảng
   - Đồng bộ theo "kênh": kết quả trận (bracket) và dự đoán (predict) dùng chung
     một endpoint + chu kỳ hỏi lại, nhưng mỗi kênh có bộ nhớ đệm, hàng đợi ghi và
     bảng dữ liệu riêng trên sheet (phân biệt bằng tham số `channel`).
   ========================================================================== */
var Store = (function () {
  'use strict';

  var endpoint = '';
  var pollMs = 10000;

  function enabled() { return !!endpoint; }

  /* Một kênh đồng bộ độc lập. `localKey`/`pendingKey` là khoá localStorage
     riêng của kênh; `name` được gửi kèm mỗi request để Apps Script biết ghi
     vào sheet nào (xem apps-script/Code.gs). */
  function createChannel(name, localKey, pendingKey) {
    var MAX_PENDING = 200;
    var pending = [];
    var statusFn = null;
    var inflight = 0;

    function setStatus(state, detail) {
      if (statusFn) statusFn(state, detail);
    }

    function loadLocal() {
      try {
        var raw = localStorage.getItem(localKey);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }

    function saveLocal(state) {
      try { localStorage.setItem(localKey, JSON.stringify(state)); } catch (e) { /* chế độ riêng tư */ }
    }

    function loadPending() {
      try { return JSON.parse(localStorage.getItem(pendingKey) || '[]'); } catch (e) { return []; }
    }
    function savePending() {
      try { localStorage.setItem(pendingKey, JSON.stringify(pending)); } catch (e) {}
    }

    function busy() { return inflight > 0; }
    function hasPending() { return pending.length > 0; }

    function post(payload) {
      payload.channel = name;
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
      fetch(endpoint + '?channel=' + encodeURIComponent(name), { method: 'GET' })
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
    function start(onRemote, onStatus) {
      statusFn = onStatus || statusFn;
      pending = endpoint ? loadPending() : [];
      if (!endpoint) return;
      if (hasPending()) flush(function (st) { onRemote(st || null); });
      else get(onRemote);
      startPolling(onRemote);
    }

    return {
      enabled: enabled,
      hasPending: hasPending,
      loadLocal: loadLocal,
      saveLocal: saveLocal,
      get: get,
      send: send,
      start: start
    };
  }

  var bracket = createChannel('bracket', 'amira-open:bracket:v1', 'amira-open:pending:v1');
  var bracketStatus = null;

  function init(tournament, onStatus) {
    var cfg = (tournament && tournament.sync) || {};
    endpoint = String(cfg.endpoint || '').trim();
    pollMs = Math.max(3, Number(cfg.pollSeconds) || 10) * 1000;
    bracketStatus = onStatus || null;
  }

  return {
    init: init,
    enabled: enabled,
    hasPending: bracket.hasPending,
    loadLocal: bracket.loadLocal,
    saveLocal: bracket.saveLocal,
    get: bracket.get,
    send: bracket.send,
    start: function (onRemote) { bracket.start(onRemote, bracketStatus); },
    /* Tạo thêm một kênh đồng bộ độc lập dùng chung endpoint (ví dụ: dự đoán). */
    channel: createChannel
  };
})();
