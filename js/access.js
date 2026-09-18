/* ==========================================================================
   AMIRA OPEN — Khoá chỉnh sửa
   - Mặc định trang ở chế độ CHỈ XEM: ai muốn ghi điểm phải nhập mật khẩu
   - Nhập đúng một lần là mở khoá cho tới khi rời trang. Trạng thái chỉ nằm
     trong bộ nhớ của trang, không ghi xuống localStorage/sessionStorage,
     nên tải lại trang (F5) là phải nhập lại.

   GIỚI HẠN CẦN BIẾT: đây là trang tĩnh, mật khẩu nằm trong js/data.js và được
   gửi thẳng về trình duyệt — ai xem mã nguồn cũng đọc được, và endpoint Apps
   Script vẫn nhận ghi từ bên ngoài. Khoá này để người xem khỏi bấm nhầm vào
   điểm, KHÔNG phải một lớp bảo mật.
   ========================================================================== */
var Access = (function () {
  'use strict';

  var password = '';
  var unlocked = false;
  var pendingAction = null;   // việc người dùng định làm trước khi bị hỏi mật khẩu
  var listeners = [];

  var modal = null, card = null, form = null, input = null, errorEl = null;
  var lastFocus = null;

  function required() { return !!password; }
  function isUnlocked() { return !required() || unlocked; }

  function notify() {
    var state = isUnlocked();
    listeners.forEach(function (fn) { fn(state); });
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return;
    listeners.push(fn);
    fn(isUnlocked());   // gọi luôn một lần để giao diện khớp trạng thái hiện tại
  }

  /* ---------- Hộp thoại nhập mật khẩu ---------- */

  function showError() {
    if (errorEl) errorEl.hidden = false;
    if (!card) return;
    card.classList.remove('is-wrong');
    void card.offsetWidth;            // ép trình duyệt chạy lại animation lắc
    card.classList.add('is-wrong');
  }

  function hideError() {
    if (errorEl) errorEl.hidden = true;
    if (card) card.classList.remove('is-wrong');
  }

  function ask() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    input.value = '';
    hideError();
    input.focus();
  }

  function close() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    pendingAction = null;
    input.value = '';
    hideError();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* So sánh sau khi cắt khoảng trắng và bỏ qua hoa/thường: bàn phím điện thoại
     hay tự viết hoa chữ đầu, bắt đúng từng ký tự chỉ tổ gây khó chịu. */
  function matches(typed) {
    return String(typed || '').trim().toLowerCase() === password.toLowerCase();
  }

  function submit(e) {
    if (e) e.preventDefault();
    if (!matches(input.value)) {
      showError();
      input.select();
      return;
    }
    var run = pendingAction;          // close() xoá pendingAction nên giữ lại trước
    unlocked = true;
    close();
    notify();
    if (run) run();
  }

  /* Cổng duy nhất đi vào mọi thao tác sửa: mở khoá rồi thì chạy luôn,
     chưa mở khoá thì hỏi mật khẩu và chạy tiếp ngay sau khi nhập đúng. */
  function requireAccess(action) {
    if (isUnlocked()) { action(); return true; }
    pendingAction = action;
    ask();
    return false;
  }

  function lock() {
    if (!unlocked) return;
    unlocked = false;
    notify();
  }

  function init(tournament) {
    var cfg = (tournament && tournament.access) || {};
    password = String(cfg.editPassword == null ? '' : cfg.editPassword).trim();

    modal = document.getElementById('passModal');
    if (!modal) return;
    card = modal.querySelector('.modal-card');
    form = document.getElementById('passForm');
    input = document.getElementById('passInput');
    errorEl = document.getElementById('passError');

    form.addEventListener('submit', submit);
    input.addEventListener('input', hideError);
    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) close();
    });

    notify();
  }

  return {
    init: init,
    onChange: onChange,
    required: required,
    isUnlocked: isUnlocked,
    require: requireAccess,
    ask: ask,
    lock: lock
  };
})();
