/* ==========================================================================
   AMIRA OPEN — Dự đoán vui (không cá cược bằng tiền)
   - Một "kèo" là lời cược giữa đúng 2 người cho MỘT trận cụ thể: người này
     cược bên A thắng, người kia cược bên B thắng. Ai đúng thì thắng kèo,
     người thua đãi người thắng một bữa trưa.
   - Không có bảng xếp hạng chung — mỗi kèo độc lập, tự giải quyết khi trận có
     kết quả. Một người có thể tham gia bao nhiêu kèo cũng được, với bất kỳ ai.
   - Một trận tự khoá (không tạo kèo mới được nữa) ngay khi có điểm đầu tiên,
     dựa vào Bracket.isStarted() do js/app.js công khai — công bằng, không ai
     lập kèo ăn theo kết quả đang diễn ra. Kèo đã lập trước đó thì giữ nguyên,
     chỉ không huỷ được nữa sau khi khoá.
   - Lưu localStorage + đồng bộ qua kênh riêng (channel "predict") trên cùng
     endpoint Apps Script với kết quả trận, xem js/store.js và apps-script/Code.gs.
   ========================================================================== */
(function () {
  'use strict';

  var channel = Store.channel('predict', 'amira-open:predict:v1', 'amira-open:predict-pending:v1');

  /* rows[betId] = { id, matchId, p1: { name, side }, p2: { name, side }, ts } */
  var rows = channel.loadLocal();

  function validRow(r) {
    return !!(r && r.matchId && r.p1 && r.p1.name && r.p2 && r.p2.name && r.p1.side && r.p2.side);
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

  function rowsOfMatch(matchId) {
    return Object.keys(rows)
      .map(function (k) { return rows[k]; })
      .filter(function (r) { return r.matchId === matchId; })
      .sort(function (a, b) { return (a.ts || '').localeCompare(b.ts || ''); });
  }

  function newBetId(matchId) {
    return matchId + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- Tạo / huỷ kèo ---------- */

  function createBet(matchId, nameA, nameB, onDone) {
    nameA = String(nameA || '').trim();
    nameB = String(nameB || '').trim();
    if (!nameA || !nameB) { toast('Nhập đủ tên hai người cược'); return; }
    if (nameA.toLowerCase() === nameB.toLowerCase()) { toast('Hai người cược phải khác nhau'); return; }
    if (Bracket.isStarted(matchId)) { toast('Trận đã bắt đầu, không lập kèo được nữa'); return; }

    var id = newBetId(matchId);
    var row = {
      id: id,
      matchId: matchId,
      p1: { name: nameA, side: 'a' },
      p2: { name: nameB, side: 'b' },
      ts: new Date().toISOString()
    };
    rows[id] = row;
    var set = {}; set[id] = row;
    commit({ set: set, clear: [] });
    if (onDone) onDone();
  }

  function cancelBet(id) {
    var row = rows[id];
    if (!row || Bracket.isStarted(row.matchId)) return; // đã khoá, không huỷ được nữa
    delete rows[id];
    commit({ set: {}, clear: [id] });
  }

  /* ---------- Bảng gửi lên sheet ---------- */

  function boardRows() {
    var out = [['Trận', 'Vòng', 'Người cược A', 'Chọn', 'Người cược B', 'Chọn', 'Kết quả']];
    TOURNAMENT.rounds.forEach(function (round) {
      round.matches.forEach(function (m) {
        var s = Bracket.state(m.id);
        rowsOfMatch(m.id).forEach(function (r) {
          var p1Pick = Bracket.playerAt(m, r.p1.side);
          var p2Pick = Bracket.playerAt(m, r.p2.side);
          var result = '';
          if (s && s.winner) {
            var winnerName = r.p1.side === s.winner ? r.p1.name : r.p2.name;
            var loserName = r.p1.side === s.winner ? r.p2.name : r.p1.name;
            result = winnerName + ' thắng · ' + loserName + ' đãi bữa trưa';
          }
          out.push([m.id, round.name, r.p1.name, p1Pick ? p1Pick.name : '', r.p2.name, p2Pick ? p2Pick.name : '', result]);
        });
      });
    });
    return out;
  }

  /* ---------- Giao diện ---------- */

  var modal = document.getElementById('predictModal');
  var listEl = document.getElementById('predictList');
  var summaryEl = document.getElementById('predictSummary');
  var nameListEl = document.getElementById('predictNames');
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

  /* Gợi ý tên: tay cơ trong giải + những tên đã từng gõ để lập kèo */
  function updateNameList() {
    if (!nameListEl) return;
    var names = {};
    PLAYERS.forEach(function (p) { names[p.name] = true; });
    Object.keys(rows).forEach(function (k) {
      var r = rows[k];
      if (r.p1) names[r.p1.name] = true;
      if (r.p2) names[r.p2.name] = true;
    });
    nameListEl.innerHTML = '';
    Object.keys(names).sort().forEach(function (n) {
      var opt = document.createElement('option');
      opt.value = n;
      nameListEl.appendChild(opt);
    });
  }

  function buildBetForm(match, a, b) {
    var form = el('div', 'predict-bet-form');
    var inputA = document.createElement('input');
    inputA.type = 'text';
    inputA.className = 'predict-name-input';
    inputA.placeholder = 'Ai cược ' + a.name + ' thắng';
    inputA.setAttribute('list', 'predictNames');
    inputA.setAttribute('autocomplete', 'off');

    var inputB = document.createElement('input');
    inputB.type = 'text';
    inputB.className = 'predict-name-input';
    inputB.placeholder = 'Ai cược ' + b.name + ' thắng';
    inputB.setAttribute('list', 'predictNames');
    inputB.setAttribute('autocomplete', 'off');

    var addBtn = el('button', 'btn btn-ghost predict-add-btn', 'Lập kèo 🤝');
    addBtn.type = 'button';
    addBtn.addEventListener('click', function () {
      createBet(match.id, inputA.value, inputB.value, function () {
        inputA.value = '';
        inputB.value = '';
        inputA.focus();
      });
    });

    form.appendChild(inputA);
    form.appendChild(el('span', 'predict-vs', 'vs'));
    form.appendChild(inputB);
    form.appendChild(addBtn);
    return form;
  }

  function buildBetList(match, bets, s, finished) {
    var ul = el('ul', 'predict-bets');
    bets.forEach(function (bet) {
      var li = el('li', 'predict-bet');
      var p1Pick = Bracket.playerAt(match, bet.p1.side);
      var p2Pick = Bracket.playerAt(match, bet.p2.side);
      li.appendChild(el('span', 'predict-bet-line',
        bet.p1.name + ' (cược ' + (p1Pick ? p1Pick.name : '?') + ')' +
        ' — ' + bet.p2.name + ' (cược ' + (p2Pick ? p2Pick.name : '?') + ')'));

      if (finished) {
        var winnerName = bet.p1.side === s.winner ? bet.p1.name : bet.p2.name;
        var loserName = bet.p1.side === s.winner ? bet.p2.name : bet.p1.name;
        li.appendChild(el('span', 'predict-bet-result is-done', '🏆 ' + winnerName + ' thắng · ' + loserName + ' đãi bữa trưa'));
      } else if (Bracket.isStarted(match.id)) {
        li.appendChild(el('span', 'predict-bet-result', 'Đang chờ kết quả'));
      } else {
        var cancel = el('button', 'link-btn', 'Huỷ');
        cancel.type = 'button';
        cancel.addEventListener('click', function () { cancelBet(bet.id); });
        li.appendChild(cancel);
      }
      ul.appendChild(li);
    });
    return ul;
  }

  function buildMatchCard(match, roundName) {
    var a = Bracket.playerAt(match, 'a');
    var b = Bracket.playerAt(match, 'b');
    var started = Bracket.isStarted(match.id);
    var s = Bracket.state(match.id);
    var finished = !!(s && s.winner);

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

    if (!started) card.appendChild(buildBetForm(match, a, b));

    var bets = rowsOfMatch(match.id);
    if (bets.length) {
      card.appendChild(buildBetList(match, bets, s, finished));
    } else if (!started) {
      card.appendChild(el('p', 'predict-hint', 'Chưa có kèo nào cho trận này'));
    }

    return card;
  }

  function buildSummary() {
    var all = Object.keys(rows).map(function (k) { return rows[k]; });
    var done = all.filter(function (r) {
      var s = Bracket.state(r.matchId);
      return s && s.winner;
    }).length;

    var box = el('div', 'predict-summary');
    box.appendChild(el('p', 'predict-board-note', (TOURNAMENT.predict && TOURNAMENT.predict.prizeNote) || ''));
    if (all.length) {
      box.appendChild(el('p', 'predict-summary-count', all.length + ' kèo đã lập · ' + done + ' kèo đã có kết quả'));
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
