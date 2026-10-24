/* @ds-bundle: {"format":4,"namespace":"DoomClock","components":[]} */
/* Drawing helpers shared by the previews. Plain functions that return SVG strings; no React. */
window.DoomClock = (function () {
  // The quarter face: midnight at the top, the last 15 minutes run anticlockwise to nine o'clock.
  // One minute on the face is one year. Same geometry as .lavish/prototype/app.js face().
  var CX = 96, CY = 96, R = 88;
  function n(v) { return Math.round(v * 100) / 100; }
  function pt(min, r) { var a = min * Math.PI / 30; return [n(CX - r * Math.sin(a)), n(CY - r * Math.cos(a))]; }
  function arc(m0, m1, r) { var p0 = pt(m0, r), p1 = pt(m1, r); return 'M' + p0 + ' A' + r + ',' + r + ' 0 0 0 ' + p1; }
  function line(cls, a, b) { return '<line class="' + cls + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>'; }

  // o: { minutes, range: [min, max], ghost: minutes, yours: minutes, labels: bool, label: aria text }
  function face(o) {
    o = o || {};
    var m = o.minutes, s = '';
    var aria = o.label || ('Clock at ' + m.toFixed(1) + ' minutes to midnight');
    s += '<svg class="dc-face" viewBox="0 0 100 100" role="img" aria-label="' + aria + '">';
    var end = pt(15, R);
    s += '<path class="sector" d="M' + CX + ',' + CY + ' L' + CX + ',' + (CY - R) + ' A' + R + ',' + R + ' 0 0 0 ' + end + ' Z"/>';
    if (o.range) s += '<path class="band" d="' + arc(o.range[0], o.range[1], R - 5) + '"/>';
    for (var k = 0; k <= 15; k++) {
      var major = k % 5 === 0;
      s += line(major ? 'tick major' : 'tick', pt(k, R - (major ? 11 : 6)), pt(k, R - 1));
    }
    s += '<path class="rim" d="' + arc(0, 15, R) + '"/>';
    if (o.labels !== false) [5, 10, 15].forEach(function (k) {
      var p = pt(k, R - 20);
      s += '<text class="num" x="' + p[0] + '" y="' + n(p[1] + 2) + '" text-anchor="middle">' + k + ' y</text>';
    });
    if (o.ghost != null) {
      s += line('ghost', pt(o.ghost, R - 15), pt(o.ghost, R + 2));
      if (o.labels !== false) { var g = pt(o.ghost, R + 4); s += '<text class="num ghost-t" x="' + n(g[0] - 2) + '" y="' + n(g[1] - 1) + '" text-anchor="end">Bulletin 85 s</text>'; }
    }
    var mid = pt(0, R);
    s += '<circle class="midnight" cx="' + mid[0] + '" cy="' + mid[1] + '" r="3"/>';
    if (o.yours != null) s += line('yours', [CX, CY], pt(o.yours, R - 12));
    // Tapered hand: wide at the hub, narrow at the tip.
    var tip = pt(m, R - 8), dx = tip[0] - CX, dy = tip[1] - CY, len = Math.sqrt(dx * dx + dy * dy), px = -dy / len, py = dx / len;
    s += '<polygon class="hand" points="' + [
      [n(CX + px * 2.6), n(CY + py * 2.6)], [n(tip[0] + px * .6), n(tip[1] + py * .6)],
      [n(tip[0] - px * .6), n(tip[1] - py * .6)], [n(CX - px * 2.6), n(CY - py * 2.6)]
    ].join(' ') + '"/>';
    s += '<circle class="hub" cx="' + CX + '" cy="' + CY + '" r="4"/></svg>';
    return s;
  }

  return { face: face };
})();
