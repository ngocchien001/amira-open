/* ==========================================================================
   AMIRA OPEN — Dự đoán vui (không cá cược bằng tiền)
   - Mỗi trận là MỘT kèo chung: ai xem trang cũng gõ tên rồi chọn một bên sẽ
     thắng, không giới hạn số người tham gia mỗi bên. Khi trận có kết quả,
     phe đoán sai đãi phe đoán đúng một bữa trưa — không tính điểm, không có
     bảng xếp hạng chung.
   - Một trận tự khoá (không tham gia/đổi ý được nữa) ngay khi có điểm đầu
     tiên, dựa vào Bracket.isStarted() do js/app.js công khai — công bằng,
     không ai chọn ăn theo kết quả đang diễn ra.
   - Trước khi khoá chỉ thấy SỐ người đã chọn mỗi bên (không lộ tên) để khỏi
     chọn theo số đông; sau khi khoá thì công khai hết tên.
   - Lưu localStorage + đồng bộ qua kênh riêng (channel "predict") trên cùng
     endpoint Apps Script với kết quả trận, xem js/store.js và apps-script/Code.gs.
   ========================================================================== */
(function () {
  'use strict';

  var NAME_KEY = 'amira-open:predict-name:v1';
  var channel = Store.channel('predict', 'amira-open:predict:v1', 'amira-open:predict-pending:v1');

  /* rows[matchId + '::' + voterKey] = { matchId, voter, name, side, ts } */
  var rows = channel.loadLocal();

  function validRow(r) {
    return !!(r && r.matchId && r.voter && r.name && r.side);
  }

  function prune(src) {
    var out = {};
    Object.keys(src).forEach(function (k) { if (validRow(src[k])) out[k] = src[k]; });
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

  function loadName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }
  function saveName(n) {
    try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* chế độ riêng tư */ }
  }
  function voterKeyOf(name) { return name.trim().toLowerCase(); }
  function rowKey(matchId, voter) { return matchId + '::' + voter; }

  function rowsOfMatch(matchId) {
    return Object.keys(rows)
      .map(function (k) { return rows[k]; })
      .filter(function (r) { return r.matchId === matchId; })
      .sort(function (a, b) { return (a.ts || '').localeCompare(b.ts || ''); });
  }

  /* ---------- Tham gia / rời kèo ---------- */

  function join(matchId, side) {
    var name = String(nameInput.value || '').trim();
    if (!name) { toast('Nhập tên trước khi chọn'); nameInput.focus(); return; }
    if (Bracket.isStarted(matchId)) return; // đã khoá

    saveName(name);
    var key = rowKey(matchId, voterKeyOf(name));
    var row = { matchId: matchId, voter: voterKeyOf(name), name: name, side: side, ts: new Date().toISOString() };
    rows[key] = row;
    var set = {}; set[key] = row;
    commit({ set: set, clear: [] });
  }

  function leave(matchId) {
    var name = String(nameInput.value || '').trim();
    if (!name || Bracket.isStarted(matchId)) return;
    var key = rowKey(matchId, voterKeyOf(name));
    if (!rows[key]) return;
    delete rows[key];
    commit({ set: {}, clear: [key] });
  }

  /* ---------- Bảng gửi lên sheet ---------- */

  function boardRows() {
    var out = [['Trận', 'Vòng', 'Tên', 'Chọn', 'Đúng?']];
    TOURNAMENT.rounds.forEach(function (round) {
      round.matches.forEach(function (m) {
        var s = Bracket.state(m.id);
        rowsOfMatch(m.id).forEach(function (r) {
          var pick = Bracket.playerAt(m, r.side);
          var correct = (s && s.winner) ? (r.side === s.winner ? 'Đúng' : 'Sai') : '';
          out.push([m.id, round.name, r.name, pick ? pick.name : r.side, correct]);
        });
      });
    });
    return out;
  }

  /* ---------- Xuất file kết quả (CSV) ---------- */

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsv(table) {
    return table.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
  }

  /* Gom đủ thông tin liên quan vào một file: kết quả từng trận, từng lượt
     tham gia dự đoán, và tổng kết đúng/sai theo tên (chỉ để tham khảo khi
     tính ai đãi ai bữa trưa — không phải bảng xếp hạng). */
  function buildExportTable() {
    var out = [];
    out.push([TOURNAMENT.name + ' — Xuất kết quả dự đoán']);
    out.push(['Xuất lúc', new Date().toLocaleString('vi-VN')]);
    out.push([]);

    out.push(['KẾT QUẢ TRẬN ĐẤU']);
    out.push(['Vòng', 'Mã trận', 'Tay cơ A', 'Tay cơ B', 'Thể thức', 'Tỉ số', 'Người thắng']);
    TOURNAMENT.rounds.forEach(function (round) {
      round.matches.forEach(function (m) {
        var a = Bracket.playerAt(m, 'a');
        var b = Bracket.playerAt(m, 'b');
        var fmt = Bracket.formatOf(m, a, b);
        var s = Bracket.state(m.id);
        var score = (s && fmt) ? Bracket.displayScore(m.id, 'a', fmt) + '–' + Bracket.displayScore(m.id, 'b', fmt) : '';
        var winner = (s && s.winner) ? Bracket.playerAt(m, s.winner).name : '';
        var fmtLabel = fmt ? (fmt.handicap ? fmt.raceTo + ' bi · chấp ' + fmt.handicap : 'Chạm ' + fmt.raceTo) : '';
        out.push([round.name, m.id, a ? a.name : '', b ? b.name : '', fmtLabel, score, winner]);
      });
    });
    out.push([]);

    out.push(['LƯỢT THAM GIA DỰ ĐOÁN']);
    out.push(['Vòng', 'Mã trận', 'Tên', 'Chọn', 'Kết quả']);
    var tally = {}; // tên -> { correct, wrong, total }
    TOURNAMENT.rounds.forEach(function (round) {
      round.matches.forEach(function (m) {
        var s = Bracket.state(m.id);
        rowsOfMatch(m.id).forEach(function (r) {
          var pick = Bracket.playerAt(m, r.side);
          var result = (s && s.winner) ? (r.side === s.winner ? 'Đúng' : 'Sai') : 'Đang chờ';
          out.push([round.name, m.id, r.name, pick ? pick.name : r.side, result]);

          var t = tally[r.name] || (tally[r.name] = { correct: 0, wrong: 0, total: 0 });
          t.total++;
          if (result === 'Đúng') t.correct++;
          else if (result === 'Sai') t.wrong++;
        });
      });
    });
    out.push([]);

    out.push(['TỔNG KẾT THEO TÊN (để tham khảo khi tính ai đãi ai — không xếp hạng)']);
    out.push(['Tên', 'Đoán đúng', 'Đoán sai', 'Đang chờ kết quả', 'Tổng lượt tham gia']);
    Object.keys(tally).sort().forEach(function (name) {
      var t = tally[name];
      out.push([name, t.correct, t.wrong, t.total - t.correct - t.wrong, t.total]);
    });

    return out;
  }

  function exportCsv() {
    var csv = '﻿' + toCsv(buildExportTable()); // BOM để Excel đọc đúng dấu tiếng Việt
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    var a = document.createElement('a');
    a.href = url;
    a.download = 'amira-open-du-doan-' + stamp + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------- Giao diện ---------- */

  var modal = document.getElementById('predictModal');
  var listEl = document.getElementById('predictList');
  var summaryEl = document.getElementById('predictSummary');
  var nameListEl = document.getElementById('predictNames');
  var nameInput = document.getElementById('predictName');
  var openBtn = document.getElementById('predictBtn');
  var exportBtn = document.getElementById('predictExportBtn');
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

  /* Gợi ý tên: tay cơ trong giải + những tên đã từng gõ để tham gia kèo */
  function updateNameList() {
    if (!nameListEl) return;
    var names = {};
    PLAYERS.forEach(function (p) { names[p.name] = true; });
    Object.keys(rows).forEach(function (k) { names[rows[k].name] = true; });
    nameListEl.innerHTML = '';
    Object.keys(names).sort().forEach(function (n) {
      var opt = document.createElement('option');
      opt.value = n;
      nameListEl.appendChild(opt);
    });
  }

  function buildMatchCard(match, roundName) {
    var a = Bracket.playerAt(match, 'a');
    var b = Bracket.playerAt(match, 'b');
    var started = Bracket.isStarted(match.id);
    var s = Bracket.state(match.id);
    var finished = !!(s && s.winner);
    var name = String(nameInput.value || '').trim();
    var mine = name ? rows[rowKey(match.id, voterKeyOf(name))] : null;

    var card = el('div', 'predict-match');
    card.dataset.match = match.id;

    var head = el('div', 'predict-match-head');
    head.appendChild(el('span', 'predict-round', roundName + (a && b ? ' · ' + a.name + ' vs ' + b.name : '')));
    if (started) head.appendChild(el('span', 'predict-locked', finished ? 'Đã xong' : 'Đã khoá'));
    card.appendChild(head);

    if (!a || !b) {
      card.appendChild(el('p', 'predict-empty', 'Chưa xác định hai tay cơ'));
      return card;
    }

    var joined = rowsOfMatch(match.id);
    var counts = { a: 0, b: 0 };
    joined.forEach(function (r) { counts[r.side] = (counts[r.side] || 0) + 1; });

    var sideRow = el('div', 'predict-side-row');
    ['a', 'b'].forEach(function (side) {
      var p = side === 'a' ? a : b;
      var col = el('div', 'predict-side');

      var btn = el('button', 'predict-side-btn', p.name);
      btn.type = 'button';
      if (mine && mine.side === side) btn.classList.add('is-picked');
      if (finished) {
        if (s.winner === side) btn.classList.add('is-actual-winner');
        if (mine && mine.side === side && s.winner !== side) btn.classList.add('is-wrong');
      }
      if (started) btn.disabled = true;
      else btn.addEventListener('click', function () { join(match.id, side); });
      col.appendChild(btn);

      if (started) {
        var names = joined.filter(function (r) { return r.side === side; }).map(function (r) { return r.name; });
        col.appendChild(el('p', 'predict-side-names', names.length ? names.join(', ') : '—'));
      } else {
        col.appendChild(el('p', 'predict-side-count', counts[side] + ' người đã chọn'));
      }
      sideRow.appendChild(col);
    });
    card.appendChild(sideRow);

    if (!started && mine) {
      var leaveBtn = el('button', 'link-btn predict-leave-btn', 'Rời kèo');
      leaveBtn.type = 'button';
      leaveBtn.addEventListener('click', function () { leave(match.id); });
      card.appendChild(leaveBtn);
    }

    if (finished) {
      var winnerP = Bracket.playerAt(match, s.winner);
      var loserSide = s.winner === 'a' ? 'b' : 'a';
      var loserP = Bracket.playerAt(match, loserSide);
      var note = counts[loserSide]
        ? '🏆 Phe chọn ' + winnerP.name + ' đúng — phe chọn ' + loserP.name + ' đãi bữa trưa 🍜'
        : '🏆 ' + winnerP.name + ' thắng.';
      card.appendChild(el('p', 'predict-result is-done', note));
    }

    return card;
  }

  function buildSummary() {
    var all = Object.keys(rows).map(function (k) { return rows[k]; });
    var matches = {};
    all.forEach(function (r) { matches[r.matchId] = true; });
    var matchIds = Object.keys(matches);
    var done = matchIds.filter(function (id) {
      var s = Bracket.state(id);
      return s && s.winner;
    }).length;

    var box = el('div', 'predict-summary');
    box.appendChild(el('p', 'predict-board-note', (TOURNAMENT.predict && TOURNAMENT.predict.prizeNote) || ''));
    if (all.length) {
      box.appendChild(el('p', 'predict-summary-count',
        all.length + ' lượt tham gia · ' + matchIds.length + ' trận có kèo · ' + done + ' đã xong'));
    }
    return box;
  }

  function render() {
    if (!listEl) return;
    updateNameList();
    listEl.innerHTML = '';
    TOURNAMENT.rounds.forEach(function (round) {
      round.matches.forEach(function (m) { listEl.appendChild(buildMatchCard(m, round.name)); });
    });
    if (summaryEl) {
      summaryEl.innerHTML = '';
      summaryEl.appendChild(buildSummary());
    }
  }

  if (nameInput) {
    nameInput.value = loadName();
    nameInput.addEventListener('input', render);
  }

  if (exportBtn) exportBtn.addEventListener('click', exportCsv);

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
