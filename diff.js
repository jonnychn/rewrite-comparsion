/* ============================================================
   Redline diff engine
   ------------------------------------------------------------
   Pure functions, no DOM. Produces aligned rows of the shape:

     { type: 'eq' | 'mod' | 'del' | 'ins',
       a: string|null, b: string|null,
       aHtml: string,  bHtml: string }

   plus a stats object for the summary panel.
   ============================================================ */

var Redline = (function () {
  'use strict';

  var PUNCT = /[.,!?;:—–\-"'“”‘’()\[\]{}…/\\]/g;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ---------- tokenising ---------- */

  // Word mode keeps whitespace runs as their own tokens so the original
  // spacing survives a round trip through the diff.
  function tokenize(line, granularity) {
    if (granularity === 'char') return line.split('');
    return line.match(/\s+|[^\s]+/g) || [];
  }

  function normalizeToken(tok, opts) {
    if (/^\s+$/.test(tok)) return ' ';
    var t = tok;
    if (opts.ignoreCase) t = t.toLowerCase();
    if (opts.ignorePunctuation) t = t.replace(PUNCT, '');
    return t;
  }

  function normalizeLine(line, opts) {
    var t = line.replace(/\s+/g, ' ').trim();
    if (opts.ignoreCase) t = t.toLowerCase();
    if (opts.ignorePunctuation) t = t.replace(PUNCT, '');
    return t;
  }

  function isWord(tok) {
    return /[^\s]/.test(tok);
  }

  function countWords(text) {
    var m = String(text).trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  /* ---------- generic LCS over two token arrays ---------- */

  // Returns ops: [{ op: '=' | '-' | '+', a: token|null, b: token|null }]
  function lcsDiff(a, b, keyOf) {
    var n = a.length, m = b.length;
    var ops = [];

    if (!n && !m) return ops;
    if (!n) { for (var q = 0; q < m; q++) ops.push({ op: '+', a: null, b: b[q] }); return ops; }
    if (!m) { for (var p = 0; p < n; p++) ops.push({ op: '-', a: a[p], b: null }); return ops; }

    // Trim the common head/tail first — cheap, and it keeps the DP table small
    // for the usual case of a lightly edited paragraph.
    var head = 0;
    while (head < n && head < m && keyOf(a[head]) === keyOf(b[head])) head++;
    var tail = 0;
    while (tail < n - head && tail < m - head &&
           keyOf(a[n - 1 - tail]) === keyOf(b[m - 1 - tail])) tail++;

    for (var h = 0; h < head; h++) ops.push({ op: '=', a: a[h], b: b[h] });

    var midA = a.slice(head, n - tail);
    var midB = b.slice(head, m - tail);
    var na = midA.length, nb = midB.length;

    if (na && nb) {
      if (na * nb > 4000000) {
        // Guard against pathological input: treat the middle as a wholesale
        // replacement rather than allocating a huge table.
        for (var x = 0; x < na; x++) ops.push({ op: '-', a: midA[x], b: null });
        for (var y = 0; y < nb; y++) ops.push({ op: '+', a: null, b: midB[y] });
      } else {
        var ka = new Array(na), kb = new Array(nb);
        for (var i0 = 0; i0 < na; i0++) ka[i0] = keyOf(midA[i0]);
        for (var j0 = 0; j0 < nb; j0++) kb[j0] = keyOf(midB[j0]);

        var dp = [];
        for (var i = 0; i <= na; i++) dp.push(new Uint32Array(nb + 1));
        for (var i1 = na - 1; i1 >= 0; i1--) {
          for (var j1 = nb - 1; j1 >= 0; j1--) {
            dp[i1][j1] = ka[i1] === kb[j1]
              ? dp[i1 + 1][j1 + 1] + 1
              : Math.max(dp[i1 + 1][j1], dp[i1][j1 + 1]);
          }
        }
        var i2 = 0, j2 = 0;
        while (i2 < na && j2 < nb) {
          if (ka[i2] === kb[j2]) { ops.push({ op: '=', a: midA[i2], b: midB[j2] }); i2++; j2++; }
          else if (dp[i2 + 1][j2] >= dp[i2][j2 + 1]) { ops.push({ op: '-', a: midA[i2], b: null }); i2++; }
          else { ops.push({ op: '+', a: null, b: midB[j2] }); j2++; }
        }
        while (i2 < na) { ops.push({ op: '-', a: midA[i2], b: null }); i2++; }
        while (j2 < nb) { ops.push({ op: '+', a: null, b: midB[j2] }); j2++; }
      }
    } else if (na) {
      for (var x2 = 0; x2 < na; x2++) ops.push({ op: '-', a: midA[x2], b: null });
    } else if (nb) {
      for (var y2 = 0; y2 < nb; y2++) ops.push({ op: '+', a: null, b: midB[y2] });
    }

    for (var t = tail; t > 0; t--) {
      ops.push({ op: '=', a: a[n - t], b: b[m - t] });
    }
    return ops;
  }

  /* ---------- inline (within-line) diff ---------- */

  function inlineDiff(lineA, lineB, opts) {
    var ta = tokenize(lineA, opts.granularity);
    var tb = tokenize(lineB, opts.granularity);
    var ops = lcsDiff(ta, tb, function (tok) { return normalizeToken(tok, opts); });

    var left = '', right = '', added = 0, removed = 0, kept = 0;
    var i = 0;

    while (i < ops.length) {
      var op = ops[i].op;
      // Collect the whole run so one <del>/<ins> can wrap several tokens.
      var buf = '';
      var j = i;
      while (j < ops.length && ops[j].op === op) {
        buf += (op === '+' ? ops[j].b : ops[j].a);
        if (op === '+' && isWord(ops[j].b)) added++;
        if (op === '-' && isWord(ops[j].a)) removed++;
        if (op === '=' && isWord(ops[j].a)) kept++;
        j++;
      }
      var html = escapeHtml(buf);
      if (op === '=') { left += html; right += html; }
      else if (op === '-') { if (buf.trim()) left += '<del class="d-del">' + html + '</del>'; else left += html; }
      else { if (buf.trim()) right += '<ins class="d-ins">' + html + '</ins>'; else right += html; }
      i = j;
    }

    return { left: left, right: right, added: added, removed: removed, kept: kept };
  }

  /* ---------- line similarity, used to pair rewrites ---------- */

  function bagOf(line, opts) {
    var toks = (normalizeLine(line, opts).match(/\S+/g) || []);
    var bag = Object.create(null);
    for (var i = 0; i < toks.length; i++) bag[toks[i]] = (bag[toks[i]] || 0) + 1;
    return { bag: bag, size: toks.length };
  }

  function similarity(lineA, lineB, opts) {
    var A = bagOf(lineA, opts), B = bagOf(lineB, opts);
    if (!A.size || !B.size) return 0;
    var shared = 0;
    for (var k in A.bag) {
      if (B.bag[k]) shared += Math.min(A.bag[k], B.bag[k]);
    }
    return shared / Math.max(A.size, B.size);
  }

  /* ---------- pair a run of deletions with a run of insertions ---------- */

  // Order-preserving alignment that maximises total similarity. Pairs below
  // the threshold stay unpaired, so a genuinely new line reads as new rather
  // than as a garbled edit of an unrelated one.
  function pairRuns(dels, inss, opts) {
    var n = dels.length, m = inss.length;
    var THRESH = 0.25;
    var sim = [];
    for (var i = 0; i < n; i++) {
      sim.push([]);
      for (var j = 0; j < m; j++) sim[i].push(similarity(dels[i], inss[j], opts));
    }

    var dp = [];
    for (var a = 0; a <= n; a++) dp.push(new Float64Array(m + 1));
    for (var i2 = n - 1; i2 >= 0; i2--) {
      for (var j2 = m - 1; j2 >= 0; j2--) {
        var pair = sim[i2][j2] >= THRESH ? sim[i2][j2] + dp[i2 + 1][j2 + 1] : -1;
        dp[i2][j2] = Math.max(pair, dp[i2 + 1][j2], dp[i2][j2 + 1]);
      }
    }

    var rows = [], i3 = 0, j3 = 0;
    while (i3 < n && j3 < m) {
      var pairScore = sim[i3][j3] >= THRESH ? sim[i3][j3] + dp[i3 + 1][j3 + 1] : -1;
      if (pairScore >= dp[i3][j3] - 1e-9 && pairScore >= 0) {
        rows.push({ type: 'mod', a: dels[i3], b: inss[j3] });
        i3++; j3++;
      } else if (dp[i3 + 1][j3] >= dp[i3][j3 + 1]) {
        rows.push({ type: 'del', a: dels[i3], b: null });
        i3++;
      } else {
        rows.push({ type: 'ins', a: null, b: inss[j3] });
        j3++;
      }
    }
    while (i3 < n) { rows.push({ type: 'del', a: dels[i3], b: null }); i3++; }
    while (j3 < m) { rows.push({ type: 'ins', a: null, b: inss[j3] }); j3++; }
    return rows;
  }

  /* ---------- public API ---------- */

  function splitLines(text) {
    return String(text)
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(function (l) { return l.replace(/\s+$/, ''); })
      .filter(function (l) { return l.trim().length > 0; });
  }

  function compare(leftText, rightText, options) {
    var opts = {
      granularity: (options && options.granularity) || 'word',
      ignoreCase: !!(options && options.ignoreCase),
      ignorePunctuation: !!(options && options.ignorePunctuation)
    };

    var la = splitLines(leftText);
    var lb = splitLines(rightText);

    var lineOps = lcsDiff(la, lb, function (l) { return normalizeLine(l, opts); });

    // Collapse del-runs immediately followed by ins-runs into paired rewrites.
    var rows = [];
    var i = 0;
    while (i < lineOps.length) {
      if (lineOps[i].op === '=') {
        rows.push({ type: 'eq', a: lineOps[i].a, b: lineOps[i].b });
        i++;
        continue;
      }
      var dels = [], inss = [];
      while (i < lineOps.length && lineOps[i].op === '-') { dels.push(lineOps[i].a); i++; }
      while (i < lineOps.length && lineOps[i].op === '+') { inss.push(lineOps[i].b); i++; }
      if (dels.length && inss.length) {
        rows = rows.concat(pairRuns(dels, inss, opts));
      } else {
        dels.forEach(function (d) { rows.push({ type: 'del', a: d, b: null }); });
        inss.forEach(function (n2) { rows.push({ type: 'ins', a: null, b: n2 }); });
      }
    }

    // Render each row and tally the stats.
    var stats = { added: 0, removed: 0, kept: 0, rowsChanged: 0, rows: rows.length };

    rows.forEach(function (row) {
      if (row.type === 'eq') {
        row.aHtml = escapeHtml(row.a);
        row.bHtml = escapeHtml(row.b);
        stats.kept += countWords(row.a);
      } else if (row.type === 'mod') {
        var d = inlineDiff(row.a, row.b, opts);
        row.aHtml = d.left;
        row.bHtml = d.right;
        stats.added += d.added;
        stats.removed += d.removed;
        stats.kept += d.kept;
        stats.rowsChanged++;
      } else if (row.type === 'del') {
        row.aHtml = '<del class="d-del">' + escapeHtml(row.a) + '</del>';
        row.bHtml = '';
        stats.removed += countWords(row.a);
        stats.rowsChanged++;
      } else {
        row.aHtml = '';
        row.bHtml = '<ins class="d-ins">' + escapeHtml(row.b) + '</ins>';
        stats.added += countWords(row.b);
        stats.rowsChanged++;
      }
    });

    var originalWords = countWords(leftText);
    stats.keptPct = originalWords ? Math.round((stats.kept / originalWords) * 100) : 0;
    stats.wordsLeft = originalWords;
    stats.wordsRight = countWords(rightText);

    return { rows: rows, stats: stats };
  }

  return {
    compare: compare,
    countWords: countWords,
    splitLines: splitLines,
    escapeHtml: escapeHtml,
    _internal: { lcsDiff: lcsDiff, similarity: similarity, inlineDiff: inlineDiff }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Redline;
