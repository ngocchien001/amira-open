/* ==========================================================================
   AMIRA OPEN — Dự đoán vui (không cá cược bằng tiền)
   - Ai xem trang cũng đoán được: gõ tên, chọn người thắng, tuỳ chọn đoán tỉ số
   - Một trận tự khoá dự đoán ngay khi trận đó có điểm đầu tiên (dựa vào
     Bracket.isStarted() do js/app.js công khai) — công bằng, không ai đoán ăn
     theo kết quả đang diễn ra
   - Trước khi khoá, không lộ ai đoán gì (chỉ thấy số người đã đoán) để khỏi
     copy theo số đông; sau khi khoá thì công khai hết
   - Tính điểm: đúng người thắng +1, đoán đúng luôn tỉ số hiển thị +1 nữa.
     Người nhiều điểm nhất được cả hội đãi 1 bữa trưa.
   - Lưu localStorage + đồng bộ qua kênh riêng (channel "predict") trên cùng
     endpoint Apps Script với kết quả trận, xem js/store.js và apps-script/Code.gs.
   ========================================================================== */
(function () {
  'use strict';

  var NAME_KEY = 'amira-open:predict-name:v1';
  var channel = Store.channel('predict', 'amira-open:predict:v1', 'amira-open:predict-pending:v1');

  /* rows[matchId + '::' + voterKey] = { matchId, voter, name, pick, scoreA, scoreB, ts } */
  var rows = channel.loadLocal();

  function prune(src) {
    var out = {};
    Object.keys(src).forEach(function (k) {
      var r = src[k];
      if (r && r.matchId && r.voter && r.pick) out[k] = r;
    });
    return out;
  }

  function commit(patch) {
    channel.saveLocal(prune(rows));
    render();
    if (!Store.enabled()) return;
    patch.board = boardRows();
    channel.send(patch, adopt);
  }

  function adopt(remote) {
    if (!remote) return;
    if (channel.hasPending()) return;
    if (JSON.stringify(remote) === JSON.stringify(prune(rows))) return;
    rows = remote;
    channel.saveLocal(prune(rows));
    render();
  }

  window.addEventListener('amira:bracket-changed', render);

  /* ---------- Người đoán ---------- */

  function loadName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }
  function saveName(n) {
    try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* chế độ riêng tư */ }
  }
  function voterKeyOf(name) { return name.trim().toLowerCase(); }

  /* ---------- Đọc kết quả trận từ Bracket (js/app.js công khai) ---------- */

  function rowKey(matchId, voter) { return matchId + '::' + voter; }

  function rowsOfMatch(matchId) {
    return Object.keys(rows)
      .map(function (k) { return rows[k]; })
      .filter(function (r) { return r.matchId === matchId; });
  }

  function savePrediction(matchId, side) {
    var name = String(nameInput.value || '').trim();
    if (!name) {
      toast('Nhập tên trước khi đặt cược nhé');
      nameInput.focus();
      return;
    }
    if (Bracket.isStarted(matchId)) return; // đã khoá, không cho sửa
    saveName(name);
    var voter = voterKeyOf(name);
    var key = rowKey(matchId, voter);
    var prev = rows[key];
    var row = {
      matchId: matchId,
      voter: voter,
      name: name,
      pick: side,
      scoreA: prev ? prev.scoreA : null,
      scoreB: prev ? prev.scoreB : null,
      ts: new Date().toISOString()
    };
    rows[key] = row;
    var set = {}; set[key] = row;
    commit({ set: set, clear: [] });
  }

  function saveScoreGuess(matchId, side, value) {
    var name = String(nameInput.value || '').trim();
    if (!name || Bracket.isStarted(matchId)) return;
    var voter = voterKeyOf(name);
    var key = rowKey(matchId, voter);
    var row = rows[key];
    if (!row) return; // phải chọn người thắng trước
    var n = value === '' ? null : Math.max(0, parseInt(value, 10) || 0);
    row[side === 'a' ? 'scoreA' : 'scoreB'] = n;
    row.ts = new Date().toISOString();
    var set = {}; set[key] = row;
    commit({ set: set, clear: [] });
  }

  /* ---------- Tính điểm ---------- */

  function leaderboard() {
    var byVoter = {}; // voter -> { name, points, correct, total }
    TOURNAMENT.rounds.forEach(function (round) {
      round.matches.forEach(function (m) {
        var s = Bracket.state(m.id);
        if (!s || !s.winner) return; // chỉ tính khi trận đã xong
        var fmt = Bracket.formatOf(m, Bracket.playerAt(m, 'a'), Bracket.playerAt(m, 'b'));
        rowsOfMatch(m.id).forEach(function (r) {
          var p = byVoter[r.voter] || (byVoter[r.voter] = { name: r.name, points: 0, correct: 0, total: 0 });
          p.name = r.name; // giữ cách viết tên gần nhất
          p.total++;
          if (r.pick !== s.winner) return;
          p.correct++;
          p.points += 1;
          if (r.scoreA != null && r.scoreB != null && fmt) {
            if (r.scoreA === Bracket.displayScore(m.id, 'a', fmt) &&
                r.scoreB === Bracket.displayScore(m.id, 'b', fmt)) {
              p.points += 1;
            }
          }
        });
      });
    });
    return Object.keys(byVoter).map(function (k) { return byVoter[k]; })
      .sort(function (a, b) { return b.points - a.points || b.correct - a.correct || a.name.localeCompare(b.name); });
  }

  /* ---------- Bảng gửi lên sheet ---------- */

  function boardRows() {
    var out = [['Trận', 'Vòng', 'Người đoán', 'Chọn thắng', 'Tỉ số đoán', 'Đúng?']];
    TOURNAMENT.rounds.forEach(function (round) {
      round.matches.forEach(function (m) {
        var s = Bracket.state(m.id);
        rowsOfMatch(m.id).forEach(function (r) {
          var pickName = Bracket.playerAt(m, r.pick);
          var guess = (r.scoreA != null && r.scoreB != null) ? (r.scoreA + '–' + r.scoreB) : '';
          var correct = (s && s.winner) ? (r.pick === s.winner ? 'Đúng' : 'Sai') : '';
          out.push([m.id, round.name, r.name, pickName ? pickName.name : r.pick, guess, correct]);
        });
      });
    });
    var lb = leaderboard();
    out.push(['', '', '', '', '', '']);
    out.push(['BXH', 'Tên', 'Điểm', 'Đoán đúng', 'Tổng lượt đoán', '']);
    lb.forEach(function (p) { out.push(['', p.name, p.points, p.correct, p.total, '']); });
    return out;
  }

  /* ---------- Giao diện ---------- */

  var modal = document.getElementById('predictModal');
  var listEl = document.getElementById('predictList');
  var boardEl = document.getElementById('predictBoard');
  var nameInput = document.getElementById('predictName');
  var openBtn = document.getElementById('predictBtn');
  var toastEl = document.getElementById('toast');
  var toastTimer;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function buildMatchCard(match, roundName) {
    var a = Bracket.playerAt(match, 'a');
    var b = Bracket.playerAt(match, 'b');
    var started = Bracket.isStarted(match.id);
    var finished = !!(Bracket.state(match.id) && Bracket.state(match.id).winner);
    var name = String(nameInput.value || '').trim();
    var mine = name ? rows[rowKey(match.id, voterKeyOf(name))] : null;

    var card = el('div', 'predict-match');
    card.dataset.match = match.id;

    var head = el('div', 'predict-match-head');
    head.appendChild(el('span', 'predict-round', roundName));
    if (started) head.appendChild(el('span', 'predict-locked', finished ? 'Đã xong' : 'Đã khoá'));
    card.appendChild(head);

    if (!a || !b) {
      card.appendChild(el('p', 'predict-empty', 'Chưa xác định hai tay cơ'));
      return card;
    }

    var pickWrap = el('div', 'predict-pick');
    ['a', 'b'].forEach(function (side) {
      var p = side === 'a' ? a : b;
      var btn = el('button', 'predict-pick-btn', p.name);
      btn.type = 'button';
      var picked = mine && mine.pick === side;
      var actual = Bracket.state(match.id) && Bracket.state(match.id).winner;
      if (picked) btn.classList.add('is-picked');
      if (finished) {
        if (actual === side) btn.classList.add('is-actual-winner');
        if (picked && actual !== side) btn.classList.add('is-wrong');
      }
      if (started) {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', function () { savePrediction(match.id, side); });
      }
      pickWrap.appendChild(btn);
      if (side === 'a') pickWrap.appendChild(el('span', 'predict-vs', 'vs'));
    });
    card.appendChild(pickWrap);

    var scoreWrap = el('div', 'predict-score');
    ['a', 'b'].forEach(function (side) {
      var input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.inputMode = 'numeric';
      input.className = 'predict-score-input';
      input.placeholder = '?';
      input.disabled = started || !mine;
      input.value = mine && mine[side === 'a' ? 'scoreA' : 'scoreB'] != null
        ? mine[side === 'a' ? 'scoreA' : 'scoreB'] : '';
      input.addEventListener('change', function () { saveScoreGuess(match.id, side, input.value); });
      scoreWrap.appendChild(input);
      if (side === 'a') scoreWrap.appendChild(el('span', 'predict-score-sep', '–'));
    });
    card.appendChild(scoreWrap);
    if (!mine && !started) {
      card.appendChild(el('p', 'predict-hint', 'Chọn người thắng trước rồi mới đoán được tỉ số'));
    }

    var picksHere = rowsOfMatch(match.id);
    if (!started) {
      if (picksHere.length) {
        card.appendChild(el('p', 'predict-count', picksHere.length + ' người đã đoán · ẩn cho tới khi khoá'));
      }
    } else if (picksHere.length) {
      var ul = el('ul', 'predict-others');
      picksHere.forEach(function (r) {
        var p = Bracket.playerAt(match, r.pick);
        var line = r.name + ': ' + (p ? p.name : r.pick);
        if (r.scoreA != null && r.scoreB != null) line += ' · ' + r.scoreA + '–' + r.scoreB;
        var li = el('li', null, line);
        if (finished) {
          var actualWinner = Bracket.state(match.id).winner;
          li.className = r.pick === actualWinner ? 'is-correct' : 'is-wrong';
        }
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }

    return card;
  }

  function buildLeaderboard() {
    var lb = leaderboard();
    var box = el('div', 'predict-board');
    box.appendChild(el('h3', 'predict-board-title', '🍜 Bảng xếp hạng dự đoán'));
    box.appendChild(el('p', 'predict-board-note', (TOURNAMENT.predict && TOURNAMENT.predict.prizeNote) || ''));
    if (!lb.length) {
      box.appendChild(el('p', 'predict-empty', 'Chưa có trận nào xong để tính điểm.'));
      return box;
    }
    var table = el('table', 'predict-table');
    var thead = el('thead');
    var hr = el('tr');
    ['#', 'Tên', 'Điểm', 'Đúng/Tổng'].forEach(function (t) { hr.appendChild(el('th', null, t)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el('tbody');
    lb.forEach(function (p, i) {
      var tr = el('tr');
      if (i === 0 && p.points > 0) tr.className = 'is-leader';
      tr.appendChild(el('td', null, String(i + 1)));
      tr.appendChild(el('td', null, p.name + (i === 0 && p.points > 0 ? ' 🍜' : '')));
      tr.appendChild(el('td', null, String(p.points)));
      tr.appendChild(el('td', null, p.correct + '/' + p.total));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    box.appendChild(table);
    return box;
  }

  function render() {
    if (!listEl) return;
    listEl.innerHTML = '';
    TOURNAMENT.rounds.forEach(function (round) {
      round.matches.forEach(function (m) {
        listEl.appendChild(buildMatchCard(m, round.name));
      });
    });
    boardEl.innerHTML = '';
    boardEl.appendChild(buildLeaderboard());
  }

  if (nameInput) {
    nameInput.value = loadName();
    nameInput.addEventListener('input', render);
  }

  if (openBtn && modal) {
    var lastFocus = null;
    openBtn.addEventListener('click', function () {
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('modal-open');
      render();
    });
    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) {
        modal.hidden = true;
        document.body.classList.remove('modal-open');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) {
        modal.hidden = true;
        document.body.classList.remove('modal-open');
      }
    });
  }

  render();
  channel.start(adopt);
})();
