/* ==========================================================================
   AMIRA OPEN — Màn giới thiệu đầu trang
   Kịch bản: logo xoay + phóng to giữa màn hình -> thu nhỏ, đẩy lên trên
             -> nội dung giải đấu hiện dần -> tự ẩn, vào trang chính.
   Toàn bộ mốc thời gian nằm trong CSS animation nên nút "Tạm dừng" chỉ cần
   đặt animation-play-state: paused là mọi thứ dừng đúng chỗ.
   ========================================================================== */
var Intro = (function () {
  'use strict';

  var SEEN_KEY = 'amira-open:intro-seen';
  var root = document.documentElement;
  var overlay = document.getElementById('intro');
  var paused = false;
  var closing = false;
  var guardTimer = null;

  function seen() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
  }
  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* bỏ qua */ }
  }

  function money(n) { return n.toLocaleString('vi-VN'); }

  function rowsHTML() {
    var ev = TOURNAMENT.event || {};
    var rows = [
      ['Thể thức', ev.format],
      ['Thời gian', ev.time],
      ['Địa điểm', [ev.venue, ev.address].filter(Boolean).join(' · ')],
      ['Lệ phí tham gia', money(TOURNAMENT.fee) + 'đ']
    ];
    return rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<div class="intro-row"><span class="intro-row-label">' + r[0] + '</span>' +
             '<span class="intro-row-value">' + r[1] + '</span></div>';
    }).join('');
  }

  function prizesHTML() {
    return (TOURNAMENT.prizes || []).map(function (p) {
      return '<div class="intro-prize">' +
               '<span class="intro-prize-icon">' + (p.icon || '🏆') + '</span>' +
               '<span class="intro-prize-rank">' + p.rank + '</span>' +
               '<span class="intro-prize-value">' + p.value +
                 (p.extra ? ' <em>' + p.extra + '</em>' : '') + '</span>' +
             '</div>';
    }).join('');
  }

  function build() {
    var html =
      '<div class="intro-stage">' +
        '<div class="intro-logo-wrap"><div class="intro-logo">' + createLogo('full') + '</div></div>' +
        '<div class="intro-info">' +
          '<h2 class="intro-title">' + TOURNAMENT.name + '</h2>' +
          '<p class="intro-tagline">Giải billiards ' + (TOURNAMENT.event && TOURNAMENT.event.format || '') + '</p>' +
          '<div class="intro-rows">' + rowsHTML() + '</div>' +
          '<div class="intro-prizes"><span class="intro-prizes-head">Giải thưởng</span>' + prizesHTML() + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="intro-controls">' +
        '<button type="button" class="intro-btn" id="introPause" aria-label="Tạm dừng giới thiệu">' +
          '<span class="intro-btn-icon" id="introPauseIcon">❚❚</span><span id="introPauseText">Tạm dừng</span>' +
        '</button>' +
        '<button type="button" class="intro-btn intro-btn-skip" id="introSkip" aria-label="Bỏ qua giới thiệu">' +
          'Bỏ qua <span class="intro-btn-icon">⏭</span>' +
        '</button>' +
      '</div>' +
      '<div class="intro-progress"><i id="introProgress"></i></div>';

    overlay.innerHTML = html;

    // Đánh số thứ tự để mỗi dòng hiện lần lượt
    var items = overlay.querySelectorAll('.intro-info > *, .intro-row, .intro-prize');
    Array.prototype.forEach.call(items, function (nodeItem, i) {
      nodeItem.style.setProperty('--i', i);
    });

    document.getElementById('introSkip').addEventListener('click', close);
    document.getElementById('introPause').addEventListener('click', togglePause);
    document.getElementById('introProgress').addEventListener('animationend', close);
  }

  function togglePause() {
    paused = !paused;
    overlay.classList.toggle('is-paused', paused);
    document.getElementById('introPauseIcon').textContent = paused ? '▶' : '❚❚';
    document.getElementById('introPauseText').textContent = paused ? 'Tiếp tục' : 'Tạm dừng';
    document.getElementById('introPause')
      .setAttribute('aria-label', paused ? 'Tiếp tục giới thiệu' : 'Tạm dừng giới thiệu');
  }

  /* Lưới an toàn: nếu vì lý do nào đó animationend không bắn, vẫn phải thoát
     được màn giới thiệu — nhưng không được cắt ngang khi người xem đang tạm dừng. */
  function armGuard(ms) {
    clearTimeout(guardTimer);
    guardTimer = setTimeout(function () {
      if (paused) return armGuard(1500);
      close();
    }, ms);
  }

  function close() {
    if (closing) return;
    closing = true;
    clearTimeout(guardTimer);
    markSeen();
    overlay.classList.add('is-leaving');
    var done = function () {
      root.classList.remove('intro-pending');
      overlay.classList.remove('is-leaving', 'is-paused');
      overlay.innerHTML = '';
      document.removeEventListener('keydown', onKey);
    };
    overlay.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 800); // phòng khi transitionend không bắn
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); togglePause(); }
  }

  function play() {
    paused = false;
    closing = false;
    root.classList.add('intro-pending');
    overlay.classList.remove('is-leaving', 'is-paused');
    build();
    document.addEventListener('keydown', onKey);
    armGuard(14000);
  }

  return {
    play: play,
    /* Chạy tự động khi mở trang, trừ khi đã xem rồi hoặc người dùng tắt hiệu ứng */
    autoPlay: function () {
      var reduce = false;
      try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
      if (reduce || (TOURNAMENT.intro && TOURNAMENT.intro.showOnce && seen())) {
        root.classList.remove('intro-pending');
        return;
      }
      play();
    }
  };
})();
