/* ==========================================================================
   AMIRA OPEN — Logic nhánh đấu
   - Ghi điểm từng ván, tự động xác định người thắng theo thể thức chạm N
   - Người thắng tự động đi tiếp vào vòng sau
   - Lưu kết quả vào localStorage
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Chỉ mục dữ liệu ---------- */

  var playerById = {};
  PLAYERS.forEach(function (p) { playerById[p.id] = p; });

  var matchById = {};
  var roundOfMatch = {};
  var nextOf = {}; // matchId -> { match: <trận kế>, side: 'a'|'b' }

  TOURNAMENT.rounds.forEach(function (round) {
    round.matches.forEach(function (m) {
      matchById[m.id] = m;
      roundOfMatch[m.id] = round;
      ['a', 'b'].forEach(function (side) {
        var slot = m[side];
        if (slot && slot.from) nextOf[slot.from] = { match: m, side: side };
      });
    });
  });

  var finalMatch = TOURNAMENT.rounds[TOURNAMENT.rounds.length - 1].matches[0];

  /* ---------- Trạng thái ---------- */

  /* state[matchId] = { a: <ván tự thắng>, b: <ván tự thắng>, winner: 'a'|'b'|null } */
  var state = Store.loadLocal();

  /* Lúc render, scoreOf() tạo sẵn ô rỗng cho mọi trận. Không lưu và không gửi đi
     những ô đó, để so sánh với dữ liệu từ sheet không bị lệch giả. */
  function prune(src) {
    var out = {};
    Object.keys(src).forEach(function (id) {
      var s = src[id];
      if (s && (s.a || s.b || s.winner)) out[id] = s;
    });
    return out;
  }

  /* Ghi lại thay đổi: luôn lưu cục bộ + vẽ lại ngay, rồi mới gửi lên sheet.
     Trang không phải chờ mạng, mất mạng vẫn ghi điểm bình thường. */
  function commit(patch) {
    Store.saveLocal(prune(state));
    render();
    if (!Store.enabled()) return;
    patch.board = boardRows();
    Store.send(patch, adopt);
  }

  /* Nhận dữ liệu từ sheet. Chỉ vẽ lại khi thực sự khác, tránh nhấp nháy. */
  function adopt(remote) {
    if (!remote) return;
    /* Còn thay đổi chưa gửi được thì màn hình đang đúng hơn sheet — giữ nguyên */
    if (Store.hasPending()) return;
    if (JSON.stringify(remote) === JSON.stringify(prune(state))) return;
    state = remote;
    Store.saveLocal(prune(state));
    render();
  }

  function scoreOf(matchId) {
    if (!state[matchId]) state[matchId] = { a: 0, b: 0, winner: null };
    return state[matchId];
  }

  /* ---------- Thể thức & hạng ---------- */

  function rankIndex(rank) {
    var i = RANKS.indexOf(rank);
    return i === -1 ? RANKS.length : i;
  }

  /* Suy ra thể thức của một trận từ hạng hai tay cơ (hoặc dùng override). */
  function formatOf(match, a, b) {
    if (!a || !b) return null;
    var diff = rankIndex(b.rank) - rankIndex(a.rank); // >0 nghĩa là a mạnh hơn
    var steps = Math.abs(diff);
    var fmt = {
      raceTo: steps === 0 ? FORMAT_RULE.raceEven : FORMAT_RULE.raceHandicap,
      handicap: steps * FORMAT_RULE.gamesPerRankStep,
      // 'a' | 'b' | null: bên ĐƯỢC chấp (tay cơ hạng thấp hơn)
      receiver: steps === 0 ? null : (diff > 0 ? 'b' : 'a')
    };
    if (match.format) {
      if (match.format.raceTo != null) fmt.raceTo = match.format.raceTo;
      if (match.format.handicap != null) fmt.handicap = match.format.handicap;
      if (match.format.receiver !== undefined) fmt.receiver = match.format.receiver;
    }
    if (!fmt.handicap) fmt.receiver = null;
    return fmt;
  }

  function formatLabel(fmt) {
    if (!fmt) return 'Chưa xác định';
    return fmt.handicap ? fmt.raceTo + ' bi · chấp ' + fmt.handicap : 'Chạm ' + fmt.raceTo;
  }

  /* Điểm hiển thị = ván tự thắng + số ván được chấp. */
  function displayScore(matchId, side, fmt) {
    var s = scoreOf(matchId);
    var bonus = (fmt && fmt.receiver === side) ? fmt.handicap : 0;
    return s[side] + bonus;
  }

  /* ---------- Giải người chơi cho từng vị trí ---------- */

  function playerAt(match, side) {
    var slot = match[side];
    if (!slot) return null;
    if (slot.player) return playerById[slot.player] || null;
    if (slot.from) {
      var src = matchById[slot.from];
      if (!src) return null;
      var w = state[slot.from] && state[slot.from].winner;
      return w ? playerAt(src, w) : null;
    }
    return null;
  }

  function loserOf(match) {
    var w = state[match.id] && state[match.id].winner;
    if (!w) return null;
    return playerAt(match, w === 'a' ? 'b' : 'a');
  }

  /* ---------- Thao tác ---------- */

  function clearDownstream(matchId) {
    var cleared = [];
    var next = nextOf[matchId];
    while (next) {
      delete state[next.match.id];
      cleared.push(next.match.id);
      next = nextOf[next.match.id];
    }
    return cleared;
  }

  function addGame(matchId, side, delta) {
    var match = matchById[matchId];
    var a = playerAt(match, 'a');
    var b = playerAt(match, 'b');
    var fmt = formatOf(match, a, b);
    if (!fmt) return;

    var s = scoreOf(matchId);
    var before = s.winner;
    s[side] = Math.max(0, s[side] + delta);

    // Không cho vượt quá mốc chạm
    var cap = fmt.raceTo - ((fmt.receiver === side) ? fmt.handicap : 0);
    if (s[side] > cap) s[side] = cap;

    s.winner = null;
    ['a', 'b'].forEach(function (sd) {
      if (displayScore(matchId, sd, fmt) >= fmt.raceTo) s.winner = sd;
    });

    var cleared = (before !== s.winner) ? clearDownstream(matchId) : [];
    var set = {}; set[matchId] = s;
    commit({ set: set, clear: cleared });
  }

  function pickWinner(matchId, side) {
    var match = matchById[matchId];
    var a = playerAt(match, 'a');
    var b = playerAt(match, 'b');
    var fmt = formatOf(match, a, b);
    if (!fmt) return;

    var s = scoreOf(matchId);
    if (s.winner === side) return;

    var need = fmt.raceTo - ((fmt.receiver === side) ? fmt.handicap : 0);
    s[side] = Math.max(s[side], need);
    // Đối thủ không thể bằng hoặc hơn mốc chạm
    var other = side === 'a' ? 'b' : 'a';
    var otherCap = fmt.raceTo - 1 - ((fmt.receiver === other) ? fmt.handicap : 0);
    s[other] = Math.min(s[other], Math.max(0, otherCap));
    s.winner = side;

    var cleared = clearDownstream(matchId);
    var set = {}; set[matchId] = s;
    commit({ set: set, clear: cleared });
  }

  function resetMatch(matchId) {
    delete state[matchId];
    var cleared = clearDownstream(matchId);
    commit({ clear: [matchId].concat(cleared) });
  }

  function resetAll() {
    state = {};
    commit({ replaceAll: true, state: {} });
  }

  /* ---------- Render ---------- */

  var bracketEl = document.getElementById('bracket');
  var connectorsEl = document.getElementById('connectors');

  function initials(name) {
    var parts = name.trim().split(/\s+/);
    var last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase();
  }

  /* Ảnh đại diện đặt ở assets/players/<id>.jpg — <id> chính là tên không dấu
     khai báo trong data.js. Thiếu file thì tự rơi về chữ cái đầu của tên.
     Ghi nhớ id nào không có ảnh để những lần vẽ lại sau khỏi gọi lại vô ích. */
  var noPhoto = {};

  function attachPhoto(node, p) {
    if (noPhoto[p.id]) return;
    var img = document.createElement('img');
    img.className = 'avatar-photo';
    img.alt = '';
    img.addEventListener('error', function () {
      noPhoto[p.id] = true;
      img.remove();
    });
    img.src = 'assets/players/' + p.id + '.jpg';
    node.appendChild(img);
  }

  function hue(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return h;
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function buildSlot(match, side, fmt) {
    var p = playerAt(match, side);
    var s = scoreOf(match.id);
    var slot = el('div', 'slot');
    slot.dataset.match = match.id;
    slot.dataset.side = side;

    if (!p) {
      slot.classList.add('is-empty');
      var q = el('div', 'avatar avatar-empty', '?');
      var who = el('div', 'who');
      who.appendChild(el('span', 'name name-empty', 'Chưa xác định'));
      slot.appendChild(q);
      slot.appendChild(who);
      return slot;
    }

    if (s.winner === side) slot.classList.add('is-winner');
    if (s.winner && s.winner !== side) slot.classList.add('is-loser');

    var av = el('div', 'avatar', initials(p.name));
    av.style.setProperty('--h', hue(p.id));
    attachPhoto(av, p);

    var who = el('div', 'who');
    who.appendChild(el('span', 'name', p.name));
    var meta = el('span', 'meta');
    meta.appendChild(el('span', 'meta-rank', 'Hạng ' + p.rank));
    if (s.winner && s.winner !== side) {
      // Trận đã xong: chỉ nhắc người thua trả tiền bàn cho gọn một dòng
      meta.appendChild(el('span', 'meta-tag meta-tag-pay', 'trả tiền bàn'));
    } else if (!s.winner && fmt && fmt.receiver === side) {
      meta.appendChild(el('span', 'meta-tag meta-tag-handicap', 'được chấp ' + fmt.handicap));
    }
    who.appendChild(meta);

    var badge = el('span', 'rank-badge', p.rank);

    var stepper = el('div', 'stepper');
    var dec = el('button', 'step-btn', '−');
    dec.type = 'button';
    dec.dataset.action = 'dec';
    dec.title = 'Bớt 1 ván';
    dec.setAttribute('aria-label', 'Bớt 1 ván của ' + p.name);

    var score = el('span', 'score', String(displayScore(match.id, side, fmt)));

    var inc = el('button', 'step-btn', '+');
    inc.type = 'button';
    inc.dataset.action = 'inc';
    inc.title = 'Thêm 1 ván';
    inc.setAttribute('aria-label', 'Thêm 1 ván cho ' + p.name);

    stepper.appendChild(dec);
    stepper.appendChild(score);
    stepper.appendChild(inc);

    var win = el('button', 'win-btn', '✓');
    win.type = 'button';
    win.dataset.action = 'win';
    win.title = 'Chọn ' + p.name + ' thắng trận';
    win.setAttribute('aria-label', 'Chọn ' + p.name + ' thắng trận');

    if (s.winner || !fmt) {
      // Khoá khi trận đã có kết quả, hoặc chưa đủ 2 tay cơ
      dec.disabled = true;
      inc.disabled = true;
    }
    if (!fmt) {
      win.disabled = true;
      win.title = 'Chờ đủ hai tay cơ';
    }

    slot.appendChild(av);
    slot.appendChild(who);
    slot.appendChild(badge);
    slot.appendChild(stepper);
    slot.appendChild(win);
    return slot;
  }

  function buildMatch(match) {
    var a = playerAt(match, 'a');
    var b = playerAt(match, 'b');
    var fmt = formatOf(match, a, b);
    var s = scoreOf(match.id);

    var card = el('article', 'match');
    card.dataset.match = match.id;
    if (!a || !b) card.classList.add('is-pending');
    if (s.winner) card.classList.add('is-done');

    var head = el('header', 'match-head');
    head.appendChild(el('span', 'match-label', 'TRẬN ĐẤU'));
    head.appendChild(el('span', 'match-format', formatLabel(fmt)));
    card.appendChild(head);

    var slots = el('div', 'slots');
    slots.appendChild(buildSlot(match, 'a', fmt));
    slots.appendChild(el('div', 'slot-divider'));
    slots.appendChild(buildSlot(match, 'b', fmt));
    card.appendChild(slots);

    var hasState = s.winner || s.a > 0 || s.b > 0;
    if (hasState || (fmt && fmt.handicap)) {
      var foot = el('footer', 'match-foot');
      var note = el('span', 'match-note');
      if (s.winner) {
        var w = playerAt(match, s.winner);
        var l = loserOf(match);
        note.textContent = '🏆 ' + w.name + ' · thắng ' +
          displayScore(match.id, s.winner, fmt) + '–' +
          displayScore(match.id, s.winner === 'a' ? 'b' : 'a', fmt) +
          (l ? ' · ' + l.name + ' trả tiền bàn' : '');
      } else if (fmt && fmt.handicap) {
        var r = playerAt(match, fmt.receiver);
        note.textContent = r ? r.name + ' được chấp ' + fmt.handicap + ' ván · chạm ' + fmt.raceTo : '';
      }
      foot.appendChild(note);
      if (hasState) {
        var reset = el('button', 'link-btn', 'Đặt lại');
        reset.type = 'button';
        reset.dataset.action = 'reset';
        foot.appendChild(reset);
      }
      card.appendChild(foot);
    }

    return card;
  }

  function buildChampion() {
    var box = el('div', 'champion');
    box.id = 'championBox';
    var w = state[finalMatch.id] && state[finalMatch.id].winner;
    var champ = w ? playerAt(finalMatch, w) : null;

    box.appendChild(el('div', 'champion-cup', '🏆'));
    var av = el('div', 'avatar avatar-lg' + (champ ? '' : ' avatar-empty'), champ ? initials(champ.name) : '?');
    if (champ) {
      av.style.setProperty('--h', hue(champ.id));
      attachPhoto(av, champ);
      box.classList.add('is-crowned');
    }
    box.appendChild(av);
    box.appendChild(el('div', 'champion-name', champ ? champ.name : 'Nhà vô địch'));
    box.appendChild(el('div', 'champion-sub', champ ? 'Nhà vô địch · Hạng ' + champ.rank : TOURNAMENT.name));
    return box;
  }

  function render() {
    // Xoá các vòng cũ, giữ lại lớp SVG
    Array.prototype.slice.call(bracketEl.querySelectorAll('.round')).forEach(function (n) {
      n.remove();
    });

    TOURNAMENT.rounds.forEach(function (round, i) {
      var col = el('section', 'round');
      col.dataset.round = round.id;
      col.appendChild(el('h2', 'round-title', round.name.toUpperCase()));
      var body = el('div', 'round-body');
      round.matches.forEach(function (m) { body.appendChild(buildMatch(m)); });
      if (i === TOURNAMENT.rounds.length - 1) body.appendChild(buildChampion());
      col.appendChild(body);
      bracketEl.appendChild(col);
    });

    requestAnimationFrame(drawConnectors);
  }

  /* ---------- Bảng gửi lên sheet cho người đọc ---------- */

  function boardRows() {
    var rows = [[
      'Mã trận', 'Vòng', 'Thể thức',
      'Tay cơ A', 'Điểm A', 'Điểm B', 'Tay cơ B',
      'Người thắng', 'Trả tiền bàn'
    ]];

    TOURNAMENT.rounds.forEach(function (round) {
      round.matches.forEach(function (m) {
        var a = playerAt(m, 'a');
        var b = playerAt(m, 'b');
        var fmt = formatOf(m, a, b);
        var s = state[m.id] || { a: 0, b: 0, winner: null };
        var w = s.winner ? playerAt(m, s.winner) : null;
        var l = s.winner ? playerAt(m, s.winner === 'a' ? 'b' : 'a') : null;

        rows.push([
          m.id,
          round.name,
          fmt ? formatLabel(fmt) : 'Chưa xác định',
          a ? a.name + ' (' + a.rank + ')' : '',
          fmt && a ? displayScore(m.id, 'a', fmt) : '',
          fmt && b ? displayScore(m.id, 'b', fmt) : '',
          b ? b.name + ' (' + b.rank + ')' : '',
          w ? w.name : '',
          l ? l.name : ''
        ]);
      });
    });

    var champ = state[finalMatch.id] && state[finalMatch.id].winner
      ? playerAt(finalMatch, state[finalMatch.id].winner) : null;
    rows.push(['', '', '', '', '', '', '', 'Vô địch: ' + (champ ? champ.name : '—'), '']);

    return rows;
  }

  /* ---------- Đường nối giữa các trận ---------- */

  function drawConnectors() {
    var base = bracketEl.getBoundingClientRect();
    var w = bracketEl.scrollWidth;
    var h = bracketEl.scrollHeight;
    connectorsEl.setAttribute('width', w);
    connectorsEl.setAttribute('height', h);
    connectorsEl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    connectorsEl.innerHTML = '';

    function rectOf(node) {
      var r = node.getBoundingClientRect();
      return {
        left: r.left - base.left, right: r.right - base.left,
        top: r.top - base.top, bottom: r.bottom - base.top,
        mid: r.top - base.top + r.height / 2,
        cx: r.left - base.left + r.width / 2
      };
    }

    function addPath(d) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'connector');
      connectorsEl.appendChild(path);
    }

    function link(fromNode, toNode) {
      if (!fromNode || !toNode) return;
      var f = rectOf(fromNode), t = rectOf(toNode);
      var x1 = f.right, y1 = f.mid, x2 = t.left, y2 = t.mid;
      if (x2 <= x1) return;
      var mx = x1 + (x2 - x1) / 2;
      var dy = y2 - y1;
      var d;
      if (Math.abs(dy) < 2) {
        d = 'M ' + x1 + ' ' + y1 + ' H ' + x2;
      } else {
        var dir = dy > 0 ? 1 : -1;
        var r = Math.min(12, Math.abs(dy) / 2, (x2 - x1) / 2);
        d = 'M ' + x1 + ' ' + y1 +
            ' H ' + (mx - r) +
            ' Q ' + mx + ' ' + y1 + ' ' + mx + ' ' + (y1 + dir * r) +
            ' V ' + (y2 - dir * r) +
            ' Q ' + mx + ' ' + y2 + ' ' + (mx + r) + ' ' + y2 +
            ' H ' + x2;
      }
      addPath(d);
    }

    /* Nối dọc: trận chung kết xuống ô vô địch (cùng một cột) */
    function linkDown(fromNode, toNode) {
      if (!fromNode || !toNode) return;
      var f = rectOf(fromNode), t = rectOf(toNode);
      if (t.top <= f.bottom) return;
      addPath('M ' + f.cx + ' ' + f.bottom + ' V ' + t.top);
    }

    Object.keys(nextOf).forEach(function (fromId) {
      link(
        bracketEl.querySelector('.match[data-match="' + fromId + '"]'),
        bracketEl.querySelector('.match[data-match="' + nextOf[fromId].match.id + '"]')
      );
    });
    linkDown(
      bracketEl.querySelector('.match[data-match="' + finalMatch.id + '"]'),
      document.getElementById('championBox')
    );
  }

  /* ---------- Sự kiện ---------- */

  bracketEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;

    if (action === 'reset') {
      var card = btn.closest('.match');
      if (!card) return;
      var id = card.dataset.match;
      /* Chưa mở khoá thì Access hỏi mật khẩu trước, nhập đúng mới chạy tiếp */
      Access.require(function () { resetMatch(id); });
      return;
    }

    var slot = btn.closest('.slot');
    if (!slot) return;
    var matchId = slot.dataset.match;
    var side = slot.dataset.side;

    Access.require(function () {
      if (action === 'inc') addGame(matchId, side, 1);
      else if (action === 'dec') addGame(matchId, side, -1);
      else if (action === 'win') pickWinner(matchId, side);
    });
  });

  document.getElementById('resetAllBtn').addEventListener('click', function () {
    Access.require(function () {
      if (confirm('Xoá toàn bộ kết quả và bắt đầu lại giải?')) resetAll();
    });
  });

  var redrawTimer;
  window.addEventListener('resize', function () {
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(drawConnectors, 100);
  });

  /* ---------- Popup lệ phí ---------- */

  var modal = document.getElementById('feeModal');
  var feeBtn = document.getElementById('feeBtn');
  var lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    document.getElementById('feeCloseBtn').focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus) lastFocus.focus();
  }

  feeBtn.addEventListener('click', openModal);
  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }

  document.getElementById('copyAccountBtn').addEventListener('click', function () {
    var num = TOURNAMENT.payment.accountNumber;
    function done() { toast('Đã sao chép số tài khoản: ' + num); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(num).then(done, function () { toast('Số tài khoản: ' + num); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = num;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { toast('Số tài khoản: ' + num); }
      ta.remove();
    }
  });

  /* ---------- Nạp thông tin giải vào giao diện ---------- */

  function money(n) { return n.toLocaleString('vi-VN'); }

  document.getElementById('tourName').textContent = TOURNAMENT.name;
  document.getElementById('tourSubtitle').textContent = TOURNAMENT.subtitle;
  document.getElementById('feeFabAmount').textContent = money(TOURNAMENT.fee) + 'đ';
  document.getElementById('feeAmount').textContent = money(TOURNAMENT.fee);
  document.getElementById('feeNoteAmount').textContent = money(TOURNAMENT.fee) + 'đ';
  document.getElementById('feeNote').textContent = TOURNAMENT.feeNote + '.';
  document.getElementById('feeModalTitle').textContent = TOURNAMENT.payment.holder;
  document.getElementById('feeAccount').textContent = TOURNAMENT.payment.accountDisplay;
  document.getElementById('feeContent').textContent = TOURNAMENT.payment.content;
  document.getElementById('feeQr').src = TOURNAMENT.payment.qr;
  /* giữ cùng công thức với <title> tĩnh trong index.html để tiêu đề tab
     không lệch với tiêu đề khi chia sẻ link */
  document.title = TOURNAMENT.name + ' — Giải billiards ' + (TOURNAMENT.event && TOURNAMENT.event.format || '');

  /* Logo trên thanh tiêu đề: dùng bản quả bi cho tương phản cao ở cỡ nhỏ,
     huy hiệu trắng viền vàng bị chìm trên nền kem. */
  document.getElementById('brandLogo').innerHTML = createLogo('icon');

  /* Xem lại màn giới thiệu */
  document.getElementById('introReplayBtn').addEventListener('click', function () {
    Intro.play();
  });

  /* ---------- Khoá chỉnh sửa ---------- */

  var lockBtn = document.getElementById('lockBtn');
  var hintEl = document.getElementById('hint');
  var HINT_EDIT = 'Bấm <b>+ / −</b> để ghi ván · bấm <b>✓</b> để chọn người thắng';
  var HINT_VIEW = 'Chế độ chỉ xem · bấm <b>Chỉ xem</b> để nhập mật khẩu';

  function renderLock(unlocked) {
    document.body.classList.toggle('is-locked', !unlocked);
    hintEl.innerHTML = unlocked ? HINT_EDIT : HINT_VIEW;
    /* Không đặt mật khẩu (access.editPassword rỗng) thì giấu luôn nút cho gọn */
    lockBtn.hidden = !Access.required();
    lockBtn.className = 'btn btn-lock' + (unlocked ? ' is-unlocked' : '');
    lockBtn.textContent = unlocked ? 'Đang mở khoá' : 'Chỉ xem';
    lockBtn.title = unlocked
      ? 'Bấm để khoá lại, trang về chế độ chỉ xem'
      : 'Bấm để nhập mật khẩu và chỉnh sửa kết quả';
  }

  lockBtn.addEventListener('click', function () {
    if (Access.isUnlocked()) {
      Access.lock();
      toast('Đã khoá — trang về chế độ chỉ xem');
    } else {
      Access.ask();
    }
  });

  Access.init(TOURNAMENT);
  Access.onChange(renderLock);

  /* ---------- Trạng thái đồng bộ ---------- */

  var syncChip = document.getElementById('syncChip');
  var SYNC_TEXT = {
    syncing: 'Đang đồng bộ…',
    ok: 'Đã đồng bộ với sheet',
    error: 'Mất kết nối — đang lưu tạm trên máy'
  };

  function showSync(kind, detail) {
    if (!syncChip) return;
    syncChip.hidden = false;
    syncChip.className = 'sync-chip is-' + kind;
    syncChip.textContent = SYNC_TEXT[kind] || '';
    syncChip.title = detail ? String(detail) : '';
  }

  Store.init(TOURNAMENT, showSync);

  render();
  window.addEventListener('load', drawConnectors);
  Intro.autoPlay();

  /* Sheet là dữ liệu chuẩn: gửi nốt thay đổi còn tồn, lấy về, rồi hỏi lại định kỳ */
  Store.start(adopt);
})();
