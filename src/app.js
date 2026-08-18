/* ============================================================
   Redline — UI wiring
   ============================================================ */

(function () {
  'use strict';

  /* ---------- demo content (sample copy, not customer text) ---------- */

  var DEMO_ORIGINAL = [
    'At every shift change someone on the support team picks up the open tickets, re-reads the history, updates the status board, and keeps the handoff notes current. One team lead described it plainly: at a larger company those tasks belong to three different roles. On a small team one person owns the entire handoff.',
    '',
    'That handoff is where new hires most often feel unprepared. The training documents cover the policy. The timing, the order, and the judgment calls during a busy queue are learned only under supervision.',
    '',
    'Teams that treat the handoff as a checked competency — not a quick verbal walkthrough — give new hires a clear path to prove readiness. The ones that assume it is already in place discover the gap later, usually under pressure.',
    '',
    'If you onboard someone this month, what specific handoff steps will you watch them complete before you sign off?'
  ].join('\n');

  var DEMO_UPDATED = [
    'A large company splits the shift handoff across three roles. A small team hands it to one person.',
    '',
    'That person is your new hire.',
    '',
    'At every shift change they pick up the open tickets, re-read the history, update the board, and hold the whole thread together. Nobody is checking their work in real time.',
    '',
    'Training documents teach the policy.',
    '',
    'They do not teach timing.',
    'They do not teach order under a full queue.',
    'They do not teach what to do when you are running behind and the notes are half written.',
    '',
    'Most new hires know the policy. They have just never run it with someone watching.',
    '',
    'Some teams watch the new hire run one full handoff and sign off. Everyone knows where they stand.',
    '',
    'The rest find out on the busiest morning, when the board is stale and the queue is already backing up.',
    '',
    'If you onboard someone this month, name the exact steps you will watch them complete before you sign off.'
  ].join('\n');

  /* ---------- element refs ---------- */

  var $ = function (id) { return document.getElementById(id); };

  var inputLeft   = $('inputLeft');
  var inputRight  = $('inputRight');
  var metaLeft    = $('metaLeft');
  var metaRight   = $('metaRight');
  var editView    = $('editView');
  var diffView    = $('diffView');
  var diffBody    = $('diffBody');
  var emptyState  = $('emptyState');
  var tabEdit     = $('tabEdit');
  var tabDiff     = $('tabDiff');
  var toastEl     = $('toast');

  var state = {
    mode: 'edit',            // 'edit' | 'diff'
    layout: 'split',         // 'split' | 'unified'
    granularity: 'word',
    ignoreCase: false,
    ignorePunctuation: false,
    onlyChanges: false,
    changeIndex: -1,
    changeNodes: []
  };

  /* ---------- helpers ---------- */

  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function updateMeta() {
    var l = Redline.countWords(inputLeft.value);
    var r = Redline.countWords(inputRight.value);
    metaLeft.textContent = l + (l === 1 ? ' word' : ' words');
    metaRight.textContent = r + (r === 1 ? ' word' : ' words');
  }

  /* ---------- rendering ---------- */

  var GUTTER = { eq: '', mod: '~', del: '−', ins: '+' };

  function render() {
    var left = inputLeft.value;
    var right = inputRight.value;

    if (!left.trim() && !right.trim()) {
      diffBody.innerHTML = '';
      diffBody.hidden = true;
      emptyState.hidden = false;
      setStats(null);
      setChangeNav([]);
      return;
    }

    diffBody.hidden = false;
    emptyState.hidden = true;

    var result = Redline.compare(left, right, {
      granularity: state.granularity,
      ignoreCase: state.ignoreCase,
      ignorePunctuation: state.ignorePunctuation
    });

    var html = '';
    var visible = 0;

    result.rows.forEach(function (row) {
      if (state.onlyChanges && row.type === 'eq') return;
      var isChange = row.type !== 'eq';
      visible++;

      var gA = row.type === 'del' ? 'g-del' : (row.type === 'mod' ? 'g-mod' : '');
      var gB = (row.type === 'ins' || row.type === 'mod') ? 'g-ins' : '';

      var aCell = row.aHtml
        ? '<div class="cell side-a">' + row.aHtml + '</div>'
        : '<div class="cell side-a is-empty"></div>';
      var bCell = row.bHtml
        ? '<div class="cell side-b">' + row.bHtml + '</div>'
        : '<div class="cell side-b is-empty"></div>';

      html += '<div class="row r-' + row.type + '"' + (isChange ? ' data-change="1"' : '') + '>' +
                '<div class="gutter g-a ' + gA + '">' + (row.type === 'ins' ? '' : GUTTER[row.type]) + '</div>' +
                aCell +
                '<div class="gutter g-b ' + gB + '">' + (row.type === 'del' ? '' : (row.type === 'eq' ? '' : GUTTER[row.type === 'mod' ? 'ins' : row.type])) + '</div>' +
                bCell +
              '</div>';
    });

    if (!visible) {
      html = '<div class="row"><div class="gutter"></div>' +
             '<div class="cell" style="grid-column: 2 / -1; color:#6b6b6b;">' +
             (state.onlyChanges ? 'No changes to show. The two versions read the same.' : 'Nothing to compare yet.') +
             '</div></div>';
    }

    diffBody.innerHTML = html;
    setStats(result.stats);
    setChangeNav(Array.prototype.slice.call(diffBody.querySelectorAll('[data-change="1"]')));
  }

  function setStats(stats) {
    $('statAdded').textContent   = stats ? stats.added : 0;
    $('statRemoved').textContent = stats ? stats.removed : 0;
    $('statLines').textContent   = stats ? stats.rowsChanged : 0;
    $('statKept').textContent    = stats ? stats.keptPct + '%' : '—';
    $('tagAdded').textContent    = (stats ? stats.added : 0) + ' added';
    $('tagRemoved').textContent  = (stats ? stats.removed : 0) + ' removed';
  }

  function setChangeNav(nodes) {
    state.changeNodes = nodes;
    state.changeIndex = -1;
    var counter = $('changeCounter');
    var show = state.mode === 'diff' && nodes.length > 0;
    counter.hidden = !show;
    $('prevChange').hidden = !show;
    $('nextChange').hidden = !show;
    if (show) counter.textContent = nodes.length + (nodes.length === 1 ? ' change' : ' changes');
  }

  function gotoChange(step) {
    var nodes = state.changeNodes;
    if (!nodes.length) return;
    state.changeIndex = (state.changeIndex + step + nodes.length) % nodes.length;
    nodes.forEach(function (n) { n.classList.remove('is-focused'); });
    var el = nodes[state.changeIndex];
    el.classList.add('is-focused');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('changeCounter').textContent = (state.changeIndex + 1) + ' of ' + nodes.length;
  }

  /* ---------- mode + layout ---------- */

  function setMode(mode) {
    state.mode = mode;
    var diff = mode === 'diff';
    editView.hidden = diff;
    diffView.hidden = !diff;
    tabEdit.classList.toggle('is-active', !diff);
    tabDiff.classList.toggle('is-active', diff);
    tabEdit.setAttribute('aria-selected', String(!diff));
    tabDiff.setAttribute('aria-selected', String(diff));
    if (diff) render(); else setChangeNav([]);
  }

  // Stacked layouts (chosen, or forced by a narrow screen) show one header,
  // so both tallies have to live in the first cell.
  var narrow = window.matchMedia('(max-width: 720px)');

  function updateHeadLabels() {
    var stacked = state.layout === 'unified' || narrow.matches;
    var cells = document.querySelectorAll('.diff-head-cell');
    var tagAdded = $('tagAdded');
    if (stacked) {
      cells[0].querySelector('.pane-title').textContent = 'Original \u2192 Updated';
      cells[0].appendChild(tagAdded);
    } else {
      cells[0].querySelector('.pane-title').textContent = 'Original';
      cells[1].appendChild(tagAdded);
    }
  }

  function setLayout(layout) {
    state.layout = layout;
    diffView.classList.toggle('is-unified', layout === 'unified');

    updateHeadLabels();

    $('viewSplit').setAttribute('aria-pressed', String(layout === 'split'));
    $('viewUnified').setAttribute('aria-pressed', String(layout === 'unified'));
    $('viewHint').textContent = layout === 'split'
      ? 'Two columns. Original on the left, rewrite on the right, aligned line for line.'
      : 'One column. Each change reads top to bottom: what was cut, then what replaced it.';
  }

  /* ---------- report ---------- */

  function buildReport() {
    var result = Redline.compare(inputLeft.value, inputRight.value, {
      granularity: state.granularity,
      ignoreCase: state.ignoreCase,
      ignorePunctuation: state.ignorePunctuation
    });
    var lines = [
      'REDLINE — comparison report',
      '',
      result.stats.added + ' words added  |  ' + result.stats.removed + ' words removed  |  ' +
      result.stats.rowsChanged + ' lines touched  |  ' + result.stats.keptPct + '% of the original wording kept',
      '',
      '----------------------------------------',
      ''
    ];
    result.rows.forEach(function (row) {
      if (row.type === 'eq') { lines.push('   ' + row.a); }
      else if (row.type === 'del') { lines.push(' - ' + row.a); }
      else if (row.type === 'ins') { lines.push(' + ' + row.b); }
      else { lines.push(' - ' + row.a); lines.push(' + ' + row.b); }
      lines.push('');
    });
    return lines.join('\n');
  }

  function copyReport() {
    if (!inputLeft.value.trim() && !inputRight.value.trim()) {
      toast('Nothing to copy yet');
      return;
    }
    var text = buildReport();
    var done = function () { toast('Report copied to your clipboard'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed — select the text manually'); }
    document.body.removeChild(ta);
  }

  /* ---------- actions ---------- */

  function loadDemo(announce) {
    inputLeft.value = DEMO_ORIGINAL;
    inputRight.value = DEMO_UPDATED;
    updateMeta();
    setMode('diff');
    if (announce) toast('Demo loaded — this is sample copy, not your text');
  }

  function clearBoth() {
    inputLeft.value = '';
    inputRight.value = '';
    updateMeta();
    setMode('edit');
    render();
    inputLeft.focus();
    toast('Cleared');
  }

  function swapSides() {
    var tmp = inputLeft.value;
    inputLeft.value = inputRight.value;
    inputRight.value = tmp;
    updateMeta();
    if (state.mode === 'diff') render();
    toast('Sides swapped');
  }

  /* ---------- events ---------- */

  var onInput = debounce(function () {
    updateMeta();
    if (state.mode === 'diff') render();
  }, 180);

  inputLeft.addEventListener('input', onInput);
  inputRight.addEventListener('input', onInput);

  tabEdit.addEventListener('click', function () { setMode('edit'); });
  tabDiff.addEventListener('click', function () { setMode('diff'); });

  $('compareBtn').addEventListener('click', function () {
    if (!inputLeft.value.trim() && !inputRight.value.trim()) {
      toast('Add text to both sides first');
      setMode('edit');
      inputLeft.focus();
      return;
    }
    setMode('diff');
  });

  $('demoBtn').addEventListener('click', function () { loadDemo(true); });
  $('demoTopBtn').addEventListener('click', function () { loadDemo(true); });
  $('demoEmptyBtn').addEventListener('click', function () { loadDemo(true); });
  $('clearBtn').addEventListener('click', clearBoth);
  $('copyBtn').addEventListener('click', copyReport);
  $('swapBtn').addEventListener('click', swapSides);

  $('viewSplit').addEventListener('click', function () { setLayout('split'); });
  $('viewUnified').addEventListener('click', function () { setLayout('unified'); });

  Array.prototype.forEach.call(document.querySelectorAll('[data-granularity]'), function (chip) {
    chip.addEventListener('click', function () {
      state.granularity = chip.getAttribute('data-granularity');
      Array.prototype.forEach.call(document.querySelectorAll('[data-granularity]'), function (c) {
        c.classList.toggle('is-active', c === chip);
      });
      if (state.mode === 'diff') render();
    });
  });

  $('optCase').addEventListener('change', function (e) {
    state.ignoreCase = e.target.checked;
    if (state.mode === 'diff') render();
  });
  $('optPunct').addEventListener('change', function (e) {
    state.ignorePunctuation = e.target.checked;
    if (state.mode === 'diff') render();
  });
  $('optOnlyChanges').addEventListener('change', function (e) {
    state.onlyChanges = e.target.checked;
    if (state.mode === 'diff') render();
  });

  $('nextChange').addEventListener('click', function () { gotoChange(1); });
  $('prevChange').addEventListener('click', function () { gotoChange(-1); });

  document.addEventListener('keydown', function (e) {
    var typing = e.target === inputLeft || e.target === inputRight;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      setMode(state.mode === 'diff' ? 'edit' : 'diff');
      return;
    }
    if (typing || state.mode !== 'diff') return;
    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); gotoChange(1); }
    if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); gotoChange(-1); }
  });

  if (narrow.addEventListener) narrow.addEventListener('change', updateHeadLabels);
  else if (narrow.addListener) narrow.addListener(updateHeadLabels);

  /* ---------- boot: demo is shown by default ---------- */

  setLayout('split');
  loadDemo(false);
})();
