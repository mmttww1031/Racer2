'use strict';
// ===== 音效 =====
const AC = {
  c: null,
  get() {
    if (!this.c) this.c = new (window.AudioContext || window.webkitAudioContext)();
    if (this.c.state === 'suspended') this.c.resume();
    return this.c;
  }
};

function beep(f, d = 0.08, type = 'sine', vol = 0.22) {
  try {
    const c = AC.get(), o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + d);
  } catch(e) {}
}

const SFX = {
  perfect: () => { beep(1320, 0.1); beep(1760, 0.15, 'sine', 0.12); },
  good: () => beep(880, 0.1, 'triangle'),
  bad: () => beep(440, 0.12, 'sawtooth', 0.12),
  miss: () => beep(150, 0.2, 'square', 0.1),
  tick: () => beep(600, 0.03, 'square', 0.05),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.3), i * 120)),
  lose: () => [400, 350, 300].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'triangle'), i * 160))
};

// ===== 特性效果 =====
const traitE = h => (h && h.trait != null && TRAITS[h.trait]) ? TRAITS[h.trait].e : {};

function traitMod(h, race, ctx) {
  const e = traitE(h), d = race.d, m = G.month;
  let p = 0;
  if (d <= 1400) p += e.short || 0;
  else if (d <= 1800) p += e.mile || 0;
  else if (d <= 2200) p += e.mid || 0;
  else p += e.long || 0;

  p += race.s === '泥' ? (e.dirt || 0) : (e.turf || 0);
  if (race.g === 'G1') p += e.g1 || 0;
  if (race.c !== 'JP') p += e.abroad || 0;
  if (m >= 9 && m <= 11) p += e.autumn || 0;
  if (m >= 3 && m <= 5) p += e.spring || 0;
  if (m >= 6 && m <= 8) p += e.summer || 0;
  if (m === 12 || m <= 2) p += e.winter || 0;
  if (race.field >= 16) p += e.big || 0;
  if (race.field <= 12) p += e.small || 0;
  if (e.streak && h.streak >= 2) p += e.streak * Math.min(3, h.streak - 1);
  if (e.revenge && h.last > 1) p += e.revenge;
  if (e.fsex && race.sex !== 'F' && h.sex === '牡') p += e.fsex * 0.5;

  const v = race.v || '';
  if (e.left && /東京|中京|新潟/.test(v)) p += e.left;
  if (e.right && /中山|阪神|京都/.test(v)) p += e.right;
  if (ctx) {
    if (e.fav && ctx.fav) p += e.fav;
    if (e.dark && ctx.dark) p += e.dark;
  }
  return p;
}

// ===== 表現計算 =====
function basePerf(h, race) {
  const s = h.st, d = race.d;
  let w;
  if (d <= 1400) w = {spd:.35, acc:.25, pow:.2, gut:.1, foc:.1};
  else if (d <= 1800) w = {spd:.3, acc:.2, sta:.15, pow:.15, gut:.1, foc:.1};
  else if (d <= 2200) w = {spd:.25, sta:.25, pow:.15, gut:.15, acc:.1, foc:.1};
  else w = {sta:.35, spd:.2, gut:.15, foc:.1, flx:.1, pow:.1};

  let p = 0;
  for (const k in w) p += s[k] * w[k];
  if (d < h.dmin) p -= (h.dmin - d) / 200 * 2.5;
  if (d > h.dmax) p -= (d - h.dmax) / 200 * 2.5;
  p -= (100 - (race.s === '泥' ? h.dirt : h.turf)) * 0.12;
  if (race.c !== 'JP') p -= (100 - s.adp) * 0.08;
  return p + h.cond + traitMod(h, race);
}

function genOpps(race, h) {
  const [lo, hi] = OPP_R[race.g], add = race.lv * 1.5, used = new Set([h.name]), arr = [];
  for (let i = 1; i < race.field; i++) {
    let n;
    do { n = genName(); } while (used.has(n));
    used.add(n);
    const t = Math.pow(Math.random(), 1.1);
    arr.push({
      name: n,
      r: +(lo + add + (hi - lo) * (1 - t) + RF(-1, 1)).toFixed(1),
      sex: race.sex === 'F' ? '牝' : (Math.random() < 0.35 ? '牝' : '牡')
    });
  }
  return arr;
}

function calcOdds(ent) {
  const ps = ent.map(e => Math.exp(e.r / 5.2)), sum = ps.reduce((a, b) => a + b, 0), p = ps.map(x => x / sum);
  ent.forEach((e, i) => {
    e.p = p[i];
    e.win = Math.max(1.1, +(0.8 / p[i]).toFixed(1));
    e.pl = Math.max(1.05, +(0.8 / Math.min(0.95, p[i] * 2.8)).toFixed(1));
  });
  return ent;
}

const quinOdds = (a, b) => Math.max(1.5, +(0.78 / (a.p * b.p * (1 / (1 - a.p) + 1 / (1 - b.p)))).toFixed(1));

function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

function margin(dt) {
  if (dt < 0.04) return '鼻';
  if (dt < 0.09) return '頭';
  if (dt < 0.16) return '頸';
  const b = dt / 0.2;
  if (b > 10) return '大差';
  const w = Math.floor(b), f = b - w;
  let fs = f < 0.2 ? '' : f < 0.4 ? '1/4' : f < 0.6 ? '1/2' : f < 0.85 ? '3/4' : '';
  if (f >= 0.85) return (w + 1) + '馬身';
  return (w ? w : '') + (fs ? (w ? ' ' : '') + fs : '') + '馬身';
}

function simRace(race, ent, h, luck, rb) {
  const te = traitE(h), ctx = { fav: ent[0].win <= 3, dark: ent[0].win >= 12 };
  const base = race.d * 0.064 - 8.8 + (race.s === '泥' ? race.d / 1000 * 1.6 : 0);
  const rows = ent.map((e, i) => {
    let perf;
    if (i === 0) {
      perf = basePerf(h, race) + luck + rb + traitMod(h, race, ctx) - traitMod(h, race) + RF(-1, 1) * (3.5 - h.st.tmp / 40) * (te.stable || 1);
    } else {
      perf = e.r + RF(-3.5, 3.5);
    }
    return {
      i,
      name: e.name,
      me: i === 0,
      time: base * (1 + (65 - perf) * 0.0007) + RF(-0.03, 0.03)
    };
  });
  rows.sort((a, b) => a.time - b.time);
  rows.forEach((r, k) => {
    r.pos = k + 1;
    r.mg = k ? margin(r.time - rows[k - 1].time) : '';
  });
  return rows;
}

// ===== 擲骰 =====
function diceModal(h, cb) {
  const te = traitE(h), F = '⚀⚁⚂⚃⚄⚅';
  modal(`<h2>比賽前的祈願</h2><p class="sub">擲骰決定今場的運氣。點擊骰子或按鈕。</p><div class="dice" onclick="rollDice()"><span id="d1">⚀</span><span id="d2">⚀</span></div><p id="dres" class="dres">　</p><button id="dbtn" class="gold" onclick="rollDice()">擲骰</button>`, 'dice-box');
  let rolled = false;
  window.rollDice = () => {
    if (rolled) return;
    rolled = true;
    const b = $('#dbtn');
    b.disabled = true;
    let n = 0;
    const iv = setInterval(() => {
      $('#d1').textContent = F[R(0, 5)];
      $('#d2').textContent = F[R(0, 5)];
      SFX.tick();
      n++;
      if (n > 24) {
        clearInterval(iv);
        const a = R(1, 6), c = R(1, 6), t = a + c + (te.dice || 0), luck = (t - 7) * 0.8, lab = t >= 11 ? '大吉' : t >= 9 ? '吉' : t >= 6 ? '平' : t >= 4 ? '凶' : '大凶';
        $('#d1').textContent = F[a - 1];
        $('#d2').textContent = F[c - 1];
        $('#dres').innerHTML = `<b>${a}+${c}${te.dice ? '+' + te.dice : ''} = ${t}</b>　<span class="luck ${t >= 9 ? 'up' : t <= 5 ? 'down' : ''}">${lab}</span>`;
        if (a + c === 12) h.flags.dice12 = 1;
        if (a + c === 2) h.flags.dice2 = 1; else delete h.flags.dice2;
        beep(t >= 9 ? 988 : t <= 5 ? 330 : 660, 0.3);
        b.textContent = '出發！';
        b.disabled = false;
        b.onclick = () => { closeModal(); cb(luck); };
      }
    }, 65);
  };
}

// ===== 音遊 =====
function rhythmGame(diff, h, cb) {
  const te = traitE(h);
  modal(`<h2>騎乘 · 難度 <span class="stars">${'★'.repeat(diff)}${'☆'.repeat(10-diff)}</span></h2><p class="sub">按 <kbd>D</kbd><kbd>F</kbd><kbd>J</kbd><kbd>K</kbd> 或點擊軌道，在判定線擊中音符</p><canvas id="rg" width="480" height="440"></canvas><div class="rgs"><span id="rg-judge">&nbsp;</span><span id="rg-combo"></span></div><button id="rg-start" class="gold" onclick="rgStart()">開始騎乘</button>`, 'rg-box');
  const cv = $('#rg'), ctx = cv.getContext('2d'), W = 480, H = 440, LN = 4, LW = W / LN, HIT = 380, KEYS = {d:0, f:1, j:2, k:3}, COL = ['#ff7b9c','#7bd4ff','#ffe17b','#9bff9b'];
  const bpm = 84 + diff * 12, beat = 60000 / bpm, total = Math.round((18 + diff * 1.4) * 1000), fall = 1450 - diff * 95, step = diff >= 6 ? beat / 2 : beat, dens = 0.28 + diff * 0.065;
  const notes = [];
  for (let t = 2200; t < total - 1200; t += step) {
    if (Math.random() < dens) {
      const l = R(0, 3);
      notes.push({ l, t, j: 0 });
      if (diff >= 5 && Math.random() < 0.08 + diff * 0.025) notes.push({ l: (l + R(1, 3)) % 4, t, j: 0 });
    }
  }
  const cnt = { P: 0, G: 0, B: 0, M: 0 };
  let combo = 0, maxc = 0, t0 = 0, on = false, raf = 0, flash = [0, 0, 0, 0], lastJ = '', jt = 0;
  
  const judge = (n, j) => {
    n.j = j;
    cnt[j[0]]++;
    if (j === 'Miss') {
      combo = 0;
      SFX.miss();
    } else {
      combo++;
      maxc = Math.max(maxc, combo);
      SFX[j.toLowerCase()]();
    }
    lastJ = j;
    jt = performance.now();
    $('#rg-judge').textContent = j;
    $('#rg-judge').className = 'j-' + j.toLowerCase();
    $('#rg-combo').textContent = combo > 1 ? combo + ' COMBO' : '';
  };

  const hit = l => {
    if (!on) return;
    const now = performance.now() - t0;
    flash[l] = now;
    let best = null, bd = 999;
    notes.forEach(n => {
      if (n.l === l && !n.j) {
        const d = Math.abs(n.t - now);
        if (d < bd) { bd = d; best = n; }
      }
    });
    if (best && bd <= 185) judge(best, bd <= 65 ? 'Perfect' : bd <= 125 ? 'Good' : 'Bad');
  };

  const kd = e => {
    const l = KEYS[e.key.toLowerCase()];
    if (l !== undefined) { e.preventDefault(); hit(l); }
  };
  const pd = e => {
    const r = cv.getBoundingClientRect(), x = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) * (W / r.width);
    hit(clamp(Math.floor(x / LW), 0, 3));
    e.preventDefault();
  };

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < LN; i++) {
      const f = Math.max(0, 1 - (now - flash[i]) / 200);
      ctx.fillStyle = `rgba(255,255,255,${0.03 + f * 0.15})`;
      ctx.fillRect(i * LW + 2, 0, LW - 4, H);
    }
    ctx.strokeStyle = 'rgba(255,215,120,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, HIT);
    ctx.lineTo(W, HIT);
    ctx.stroke();
    for (let i = 0; i < LN; i++) {
      ctx.fillStyle = COL[i];
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(i * LW + LW / 2, HIT, 16, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DFJK'[i], i * LW + LW / 2, H - 12);
    }
    notes.forEach(n => {
      if (n.j && n.j !== 'Miss') return;
      const y = HIT - (n.t - now) / fall * HIT;
      if (y < -20 || y > H + 20) return;
      ctx.fillStyle = n.j === 'Miss' ? 'rgba(120,120,120,0.5)' : COL[n.l];
      ctx.beginPath();
      ctx.arc(n.l * LW + LW / 2, y, 14, 0, 7);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    if (lastJ && now - jt < 400) {
      const a = 1 - (now - jt) / 400;
      ctx.globalAlpha = a;
      ctx.fillStyle = { Perfect: '#ffd700', Good: '#7bd4ff', Bad: '#ff9b6b', Miss: '#888' }[lastJ];
      ctx.font = 'bold 36px "Noto Serif TC",serif';
      ctx.fillText(lastJ, W / 2, HIT - 80 - (1 - a) * 30);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`P ${cnt.P}  G ${cnt.G}  B ${cnt.B}  M ${cnt.M}`, 8, 16);
    ctx.fillStyle = 'rgba(255,215,120,0.8)';
    ctx.fillRect(0, 0, W * Math.min(1, now / total), 3);
  }

  function loop() {
    const now = performance.now() - t0;
    notes.forEach(n => { if (!n.j && now - n.t > 185) judge(n, 'Miss'); });
    draw(now);
    if (now < total) raf = requestAnimationFrame(loop); else finish();
  }

  function finish() {
    on = false;
    document.removeEventListener('keydown', kd);
    const N = notes.length || 1, acc = (cnt.P + cnt.G * 0.6 + cnt.B * 0.25) / N, bonus = +(acc * 5 * (te.rhythm || 1)).toFixed(2), rank = acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D';
    if (cnt.P === N && N >= 10) h.flags.perfect = 1;
    modal(`<h2>騎乘結果</h2><div class="rg-res"><div class="rg-rank">${rank}</div><table><tr><td>Perfect</td><td>${cnt.P}</td></tr><tr><td>Good</td><td>${cnt.G}</td></tr><tr><td>Bad</td><td>${cnt.B}</td></tr><tr><td>Miss</td><td>${cnt.M}</td></tr><tr><td>最大連擊</td><td>${maxc}</td></tr><tr><td>準確度</td><td>${(acc*100).toFixed(1)}%</td></tr><tr><td>比賽加成</td><td class="hl">+${bonus}</td></tr></table></div><button class="gold" onclick="closeModal();window._rgcb()">觀看比賽</button>`);
    window._rgcb = () => cb(bonus, { acc, rank, cnt });
  }

  window.rgStart = () => {
    AC.get();
    $('#rg-start').style.display = 'none';
    document.addEventListener('keydown', kd);
    cv.addEventListener('mousedown', pd);
    cv.addEventListener('touchstart', pd, { passive: false });
    let c = 3;
    const cd = setInterval(() => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 72px "Noto Serif TC",serif';
      ctx.textAlign = 'center';
      ctx.fillText(c > 0 ? c : 'GO!', W / 2, H / 2);
      SFX.tick();
      if (c <= 0) {
        clearInterval(cd);
        t0 = performance.now();
        on = true;
        loop();
      }
      c--;
    }, 600);
  };
}

// ===== 比賽動畫 =====
function raceAnim(race, rows, cb) {
  const n = rows.length, H = n * 22 + 50, W = 680;
  modal(`<h2>${race.n}</h2><p class="sub">${race.v||CTRY[race.c]} ${race.s}${race.d}m · ${n}頭</p><canvas id="ra" width="${W}" height="${H}"></canvas><p id="ra-msg" class="ra-msg">&nbsp;</p>`, 'ra-box');
  const cv = $('#ra'), ctx = cv.getContext('2d'), best = rows[0].time, dur = 6000, t0 = performance.now(), last = rows[n - 1].time, seed = rows.map(() => Math.random() * 6);
  const lane = rows.slice().sort((a, b) => a.i - b.i);
  
  (function frame() {
    const e = performance.now() - t0;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = race.s === '泥' ? '#6b5a3e' : '#2e6b3a';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i <= 8; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(40 + i * 72, 0);
      ctx.lineTo(40 + i * 72, H);
      ctx.stroke();
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W - 40, 0);
    ctx.lineTo(W - 40, H);
    ctx.stroke();
    ctx.lineWidth = 1;
    
    let done = true;
    lane.forEach((r, k) => {
      const need = dur * (r.time / best), prog = Math.min(1, e / need);
      if (prog < 1) done = false;
      const wob = prog < 0.96 ? Math.sin(e / 280 + seed[k]) * 5 * (1 - prog * 0.5) : 0;
      const x = 40 + prog * (W - 80) + wob, y = 25 + k * 22;
      ctx.fillStyle = r.me ? '#ffd700' : 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(x, y, 12, 7, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = r.me ? '#000' : '#222';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.i + 1, x, y + 3.5);
      ctx.textAlign = 'left';
      ctx.fillStyle = r.me ? '#ffd700' : 'rgba(255,255,255,0.7)';
      ctx.font = (r.me ? 'bold ' : '') + '11px sans-serif';
      ctx.fillText(r.name, 4, y + 4);
    });
    
    const me = rows.find(r => r.me);
    $('#ra-msg').textContent = e < 1000 ? '出閘！' : e < dur * 0.5 ? '各馬進入直路前…' : e < dur * 0.9 ? '最後直路，激烈爭持！' : (me.pos === 1 ? '衝線！你的愛馬勝出了！' : '衝線！');
    if (!done && e < dur * (last / best) + 600) requestAnimationFrame(frame);
    else {
      me.pos === 1 ? SFX.win() : SFX.lose();
      setTimeout(cb, 900);
    }
  })();
}
