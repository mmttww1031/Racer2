'use strict';
const $ = s => document.querySelector(s);
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
      RF = (a, b) => a + Math.random() * (b - a),
      pick = a => a[Math.floor(Math.random() * a.length)],
      clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
      fmt = n => Math.round(n).toLocaleString();
const apt = v => v >= 90 ? 'A' : v >= 75 ? 'B' : v >= 60 ? 'C' : v >= 45 ? 'D' : 'E';
const today = () => new Date().toISOString().slice(0, 10);

let G, _next = null;
window.nx = () => { const f = _next; _next = null; if (f) f(); };

const DEF = () => ({
  year: 1, month: 1, week: 1, pts: 6000,
  horse: null, retired: [], market: [], mkKey: '',
  achv: [], recentT: [],
  daily: { date: '', login: 0, finish: 0, g1: 0, finishA: 0, g1A: 0 },
  used: [], weekKey: '', weekRaces: [], entries: {}, bets: [],
  hist: { horses: 0, g1: 0, wins: 0, bestScore: 0 }
});

function save() { localStorage.setItem('gl_save', JSON.stringify(G)); }
function load() {
  try {
    const s = localStorage.getItem('gl_save');
    G = s ? Object.assign(DEF(), JSON.parse(s)) : DEF();
  } catch(e) { G = DEF(); }
}

function modal(html, cls = '') {
  $('#modal').classList.remove('hidden');
  const b = $('#modal-box');
  b.className = cls;
  b.innerHTML = html;
  b.scrollTop = 0;
}
function closeModal() { $('#modal').classList.add('hidden'); }
function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('on'), 2800);
}
function runQ(q) { const f = q.shift(); if (f) f(() => runQ(q)); else render(); }

const timeStr = () => `第${G.year}年 ${G.month}月 第${G.week}週`;
const condStr = c => c >= 3 ? '<b class="up">絕好調</b>' : c >= 1 ? '<b class="up">好調</b>' : c <= -3 ? '<b class="down">絕不調</b>' : c <= -1 ? '<b class="down">不調</b>' : '普通';
const rating = h => STATS.reduce((a, [k]) => a + h.st[k], 0) / 10;

// ===== 馬匹生成 =====
function mkHorse(sex, rb, tal, o = {}) {
  const st = {};
  STATS.forEach(([k]) => st[k] = clamp(Math.round((o.base ? o.base[k] : rb) + RF(-7, 7)), 12, 99));
  const dmin = o.dmin || pick([1000, 1200, 1200, 1400, 1600, 1600, 1800, 2000, 2200]);
  return {
    id: Date.now() + R(0, 9999),
    name: o.name || genName(),
    sex, age: 2, st, tal,
    gr: o.gr || pick(['早熟', '普通', '普通', '晚成']),
    dmin,
    dmax: Math.min(3400, o.dmax || dmin + pick([400, 600, 800, 800, 1000, 1200])),
    turf: o.turf || R(60, 100),
    dirt: o.dirt || R(20, 100),
    trait: null, fame: 0, starts: 0, wins: 0, p2: 0, p3: 0, earn: 0,
    res: [], flags: {}, streak: 0, maxStreak: 0, last: 0,
    born: G.year - 2,
    sire: o.sire || '不明',
    dam: o.dam || '不明',
    cond: R(-2, 2),
    peak: null, achv: []
  };
}

const wTal = () => { const r = Math.random(); return r < .1 ? 1 : r < .35 ? 2 : r < .7 ? 3 : r < .92 ? 4 : 5; };
const SCOUT = [
  ['血統平平，能跑就好。', '看起來沒甚麼特別。'],
  ['普通的一匹馬，努力或許能贏幾場。', '中規中矩。'],
  ['有一定潛力，值得期待。', '身體結構不錯。'],
  ['牧場的推薦馬，肌肉線條出色。', '眼神銳利，前途看好。'],
  ['「這匹馬絕對不一樣」牧場長如是說。', '被稱為牧場的至寶。']
];

function genMarket() {
  G.market = [];
  for (let i = 0; i < 6; i++) {
    const tal = wTal(), rb = R(36, 52), h = mkHorse(i < 3 ? '牡' : '牝', rb, tal);
    h.price = Math.round((rb * 45 + tal * 520 + R(-250, 250)) / 50) * 50;
    const st = Math.random() < 0.75 ? tal : clamp(tal + pick([-1, 1]), 1, 5);
    h.scout = pick(SCOUT[st - 1]);
    G.market.push(h);
  }
  G.mkKey = G.year + '-' + G.month;
}

// ===== 畫面渲染 =====
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 'sc-' + id));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.s === id));
  render();
}

function render() {
  $('#hud-time').textContent = timeStr();
  $('#hud-pts').textContent = fmt(G.pts) + ' 積分';
  const on = document.querySelector('.screen.on');
  if (!on) return;
  ({
    'sc-home': renderHome,
    'sc-race': renderRace,
    'sc-market': renderMarket,
    'sc-breed': renderBreed,
    'sc-hall': renderHall,
    'sc-daily': renderDaily,
    'sc-achv': renderAchv
  })[on.id]();
  save();
}

const statBars = st => STATS.map(([k, l]) => `<div class="stat"><span>${l}</span><div class="bar"><i style="width:${st[k]}%"></i></div><b>${st[k]}</b></div>`).join('');

function horseCard(h, extra = '') {
  const t = h.trait != null ? TRAITS[h.trait] : null;
  return `<div class="card horse">
    <div class="hname">${h.name}<small>${h.sex} ${h.age}歲 · ${t ? t.n : '？'}</small></div>
    <div class="hinfo">
      <span>知名度 <b>${h.fame}</b></span>
      <span>成績 <b>${h.starts}戰${h.wins}勝</b> [${h.wins}-${h.p2}-${h.p3}-${h.starts-h.wins-h.p2-h.p3}]</span>
      <span>獎金 <b>${fmt(h.earn)}萬</b></span>
      <span>狀態 ${condStr(h.cond)}</span>
      <span>距離 <b>${h.dmin}-${h.dmax}m</b></span>
      <span>草 <b>${apt(h.turf)}</b> 泥 <b>${apt(h.dirt)}</b></span>
      <span>父 ${h.sire} / 母 ${h.dam}</span>
      ${t ? `<span class="trait">特性：${t.n} — ${t.d}</span>` : ''}
    </div>
    <div class="stats">${statBars(h.st)}</div>
    ${extra}
  </div>`;
}

function renderHome() {
  const h = G.horse, el = $('#sc-home');
  if (!h) {
    el.innerHTML = `<div class="card empty">
      <h2>馬房空空如也</h2>
      <p>前往市場購入一匹馬，或使用退役馬繁殖新一代，開始你的競馬人生。</p>
      <button class="gold" onclick="show('market')">前往市場</button>
      <button onclick="show('breed')">繁殖</button>
    </div>`;
    return;
  }
  const g1 = g1w(h),
        recent = h.res.slice(-6).reverse().map(r => `<li><span class="g ${r.g}">${r.g}</span> ${r.n} <b class="${r.pos===1?'up':''}">${r.pos}着</b> <small>${r.time}</small></li>`).join('') || '<li>尚未出走</li>';
  el.innerHTML = `<div class="grid2">
    ${horseCard(h, `<div class="btns">
      <button class="gold" onclick="show('race')">出走比賽</button>
      <button onclick="rest()">休息一週</button>
      <button class="danger" onclick="confirmRetire()">退役</button>
    </div>`)}
    <div>
      <div class="card">
        <h3>近況</h3>
        <p>${timeStr()}｜G1勝利 ${g1} 場｜連勝 ${h.streak}</p>
        <ul class="reslist">${recent}</ul>
      </div>
      <div class="card tip">
        <h3>指南</h3>
        <p>每週可選擇「出走」或「休息」。每季（1/4/7/10月）馬匹會依資質與早晚熟自然成長或衰老。知名度是參加大賽的門票，普通賽事人人可跑。積分是主要貨幣，可靠投注、每日任務及退役馬種馬費賺取。</p>
      </div>
    </div>
  </div>`;
}

// ===== 休息 =====
function rest() {
  if (!G.horse) return;
  const ei = R(0, EVENTS.length - 1), ev = EVENTS[ei];
  modal(`<h2>${ev.t}</h2><p class="story">${ev.d}</p><div class="opts">${ev.o.map((o, i) => `<button onclick="restChoose(${ei},${i})">${o.t}</button>`).join('')}</div>`, 'ev');
}

window.restChoose = (ei, oi) => {
  const ev = EVENTS[ei], o = ev.o[oi], h = G.horse, ch = [];
  for (const k in o.e) {
    h.st[k] = clamp(h.st[k] + o.e[k], 1, 99);
    ch.push(`<span class="${o.e[k]>0?'up':'down'}">${LBL[k]} ${o.e[k]>0?'+':''}${o.e[k]}</span>`);
  }
  if (o.fame) {
    h.fame += o.fame;
    ch.push(`<span class="up">知名度 +${o.fame}</span>`);
  }
  modal(`<h2>${ev.t}</h2><p class="story">${o.r}</p><p class="delta">${ch.join('　') || '數值無變化'}</p><button class="gold" onclick="closeModal();advance()">繼續</button>`, 'ev');
};

// ===== 時間推進 =====
function advance() {
  const h = G.horse, q = [];
  G.week++;
  if (G.week > 4) {
    G.week = 1;
    G.month++;
    if (G.month > 12) {
      G.month = 1;
      G.year++;
      q.push(yearEnd);
    }
  }
  if (h && G.week === 1 && [1, 4, 7, 10].includes(G.month)) q.push(n => quarter(h, n));
  if (h) h.cond = R(-3, 3);
  G.weekKey = '';
  G.bets.forEach(b => G.pts += b.amt); // 未結算的投注退還
  G.bets = [];
  G.entries = {};
  save();
  runQ(q);
}

function yearEnd(next) {
  if (G.horse) G.horse.age++;
  let total = 0;
  const rows = G.retired.map(r => {
    const yrs = Math.max(1, G.year - r.retYear), fee = Math.round(r.score * 0.03 * (r.sex === '牡' ? 1 : 0.5) * Math.pow(0.85, yrs - 1));
    total += fee;
    return `<tr><td>${r.name}</td><td>${r.rank}</td><td>${r.sex}</td><td class="hl">+${fmt(fee)}</td></tr>`;
  }).join('');
  G.pts += total;
  modal(`<h2>第${G.year}年 新春</h2><p class="story">新的一年開始了。${G.horse ? `${G.horse.name} 已經 ${G.horse.age} 歲。` : ''}</p>${rows ? `<h3>種馬費收入</h3><table class="tbl"><tr><th>馬名</th><th>評級</th><th>性別</th><th>種馬費</th></tr>${rows}</table><p class="delta">合計 <b class="up">+${fmt(total)}</b> 積分</p>` : '<p>暫無退役馬帶來種馬費。</p>'}<button class="gold" onclick="closeModal();nx()">繼續</button>`);
  _next = next;
}

function quarter(h, next) {
  const te = traitE(h), gr = te.grow || h.gr, talf = [0, .6, .8, 1, 1.25, 1.5][h.tal],
        tbl = { 早熟: [3,2,.5,-1,-2,-3,-4,-5], 普通: [2,2.5,1.5,0,-1.5,-2.5,-4,-5], 晚成: [1,1.5,2.5,2,0,-1.5,-3,-4] };
  let base = tbl[gr][clamp(h.age - 2, 0, 7)];
  base = base < 0 ? base * (te.aging || 1) : base * talf;
  const rows = STATS.map(([k, l]) => {
    const d = Math.round(base + RF(-1.2, 1.2) + (te['g' + k] || 0)), o = h.st[k];
    h.st[k] = clamp(o + d, 1, 99);
    const dd = h.st[k] - o;
    return `<tr><td>${l}</td><td>${o}</td><td>→</td><td><b>${h.st[k]}</b></td><td class="${dd>0?'up':dd<0?'down':''}">${dd>0?'+':''}${dd||'—'}</td></tr>`;
  }).join('');
  const r = rating(h);
  if (!h.peak || r > h.peak.r) h.peak = { r, st: { ...h.st } };
  modal(`<h2>${h.age}歲 ${G.month}月 · 定期檢查</h2><p class="story">${base > 0.5 ? '牠正處於成長期，身體日漸強壯。' : base < -0.5 ? '歲月不饒馬，牠的身體開始出現衰退的跡象。' : '牠的狀態穩定，維持在巔峰附近。'}</p><table class="tbl growth">${rows}</table><button class="gold" onclick="closeModal();nx()">確認</button>`);
  _next = () => {
    if (h.age >= 9) {
      modal(`<h2>強制退役</h2><p class="story">${h.name} 已經 9 歲，依規定必須退役。</p><button class="gold" onclick="closeModal();nx()">進入退役儀式</button>`);
      _next = () => retireHorse(next);
    } else if (h.st.con < 12) {
      modal(`<h2>傷病退役</h2><p class="story">獸醫宣布 ${h.name} 的身體已無法承受比賽，只能退役。</p><button class="gold" onclick="closeModal();nx()">進入退役儀式</button>`);
      _next = () => retireHorse(next);
    } else next();
  };
}

// ===== 市場 =====
function renderMarket() {
  if (G.mkKey !== G.year + '-' + G.month) genMarket();
  const el = $('#sc-market');
  el.innerHTML = `<div class="card">
    <h2>馬市 <small>每月更新 · 積分 ${fmt(G.pts)}</small><button class="sm" onclick="refreshMarket()">刷新 (300積分)</button></h2>
    ${G.horse ? '<p class="warn">你已擁有一匹馬，退役後才可購入新馬。</p>' : ''}
    <div class="mk">${G.market.map((h, i) => `<div class="mkitem">
      <div class="hname">${h.name}<small>${h.sex} 2歲 · ${h.dmin}-${h.dmax}m · 草${apt(h.turf)} 泥${apt(h.dirt)}</small></div>
      <p class="scout">「${h.scout}」</p>
      <div class="stats sm">${statBars(h.st)}</div>
      <button class="gold" ${G.horse || G.pts < h.price ? 'disabled' : ''} onclick="buy(${i})">${fmt(h.price)} 積分</button>
    </div>`).join('')}</div>
  </div>`;
}

window.refreshMarket = () => {
  if (G.pts < 300) return toast('積分不足');
  G.pts -= 300;
  genMarket();
  render();
};

window.buy = i => {
  const h = G.market[i];
  if (G.horse || G.pts < h.price) return;
  G.pts -= h.price;
  G.market.splice(i, 1);
  delete h.price;
  delete h.scout;
  h.born = G.year - 2;
  acquire(h);
};

function acquire(h) {
  nameModal(h, () => traitDraw(h, () => {
    G.horse = h;
    G.hist.horses++;
    save();
    show('home');
    toast(`${h.name} 加入了馬房！`);
  }));
}

function nameModal(h, cb) {
  modal(`<h2>為愛馬命名</h2><p class="sub">${h.sex} · 父 ${h.sire} / 母 ${h.dam}</p><input id="nm" maxlength="10" value="${h.name}"><button class="gold" onclick="nx()">確定</button>`);
  const ok = () => {
    const v = $('#nm').value.trim();
    if (!v || G.used.includes(v)) {
      _next = ok;
      return toast(v ? '名字已被使用' : '請輸入名字');
    }
    h.name = v;
    G.used.push(v);
    closeModal();
    cb();
  };
  _next = ok;
}

function traitDraw(h, cb) {
  const cands = TRAITS.map((t, i) => i).filter(i => !G.recentT.includes(i)), ti = pick(cands);
  G.recentT.push(ti);
  if (G.recentT.length > 10) G.recentT.shift();
  h.trait = ti;
  modal(`<h2>隱藏特性抽選</h2><p class="sub">每匹馬都有與生俱來的特性…</p><div class="draw"><div id="drawN">？？？</div></div><p id="drawD" class="sub">&nbsp;</p><button id="drawB" class="gold" style="visibility:hidden" onclick="closeModal();nx()">確認</button>`);
  _next = cb;
  let n = 0, iv = 60;
  const step = () => {
    $('#drawN').textContent = TRAITS[R(0, TRAITS.length - 1)].n;
    SFX.tick();
    n++;
    if (n < 28) {
      iv += n > 18 ? 25 : 2;
      setTimeout(step, iv);
    } else {
      $('#drawN').textContent = TRAITS[ti].n;
      $('#drawN').classList.add('final');
      $('#drawD').textContent = TRAITS[ti].d;
      $('#drawB').style.visibility = 'visible';
      SFX.win();
    }
  };
  setTimeout(step, iv);
}

// ===== 比賽 =====
function weekRaces() {
  const key = `${G.year}-${G.month}-${G.week}`;
  if (G.weekKey === key) return;
  G.weekKey = key;
  G.weekRaces = ORD.map((o, i) => {
    const s = Math.random() < 0.7 ? '草' : '泥',
          v = pick(VENUES),
          d = s === '草' ? pick([1200, 1400, 1600, 1600, 1800, 2000, 2000, 2200, 2400, 2600, 3000]) : pick([1200, 1400, 1600, 1800, 1800, 2100]);
    return {
      id: 'o' + i,
      n: `${v} ${o.n}`,
      g: o.g, d, s, c: 'JP', v,
      field: R(o.field[0], o.field[1]),
      prize: o.prize, diff: o.diff, fame: o.fame,
      age: [2, 9], sex: null, lv: 0, wmax: o.wmax
    };
  });
  G.entries = {};
  G.bets = [];
}

const allRaces = () => [...G.weekRaces, ...RACES.filter(r => r.m === G.month && r.w === G.week)];
const findRace = id => allRaces().find(r => r.id === id);

function elig(h, r) {
  if (h.age < r.age[0] || h.age > r.age[1]) return `限${r.age[0]===r.age[1]?r.age[0]+'歲':r.age[0]+'歲以上'}`;
  if (r.sex === 'F' && h.sex !== '牝') return '限牝馬';
  if (r.wmax !== undefined && h.wins > r.wmax) return '勝利數超過';
  if (h.fame < r.fame) return `知名度不足(${r.fame})`;
  return '';
}

function renderRace() {
  const h = G.horse, el = $('#sc-race');
  if (!h) {
    el.innerHTML = '<div class="card empty"><h2>沒有可出走的馬</h2></div>';
    return;
  }
  weekRaces();
  const list = allRaces().map(r => {
    const e = elig(h, r), ab = r.c !== 'JP';
    return `<div class="ritem ${e?'no':''} ${ab?'abroad':''}" ${e?'':`onclick="openRace('${r.id}')"`}>
      <span class="g ${r.g}">${r.g}</span>
      <div class="rn">${r.n}<small>${r.v||CTRY[r.c]} · ${r.s}${r.d}m · ${r.field}頭 · 獎金${fmt(r.prize)}萬 · 音遊${'★'.repeat(r.diff)}${r.sex==='F'?' · 牝馬限定':''}${r.age[0]===r.age[1]?` · ${r.age[0]}歲限定`:''}</small></div>
      <span class="req">${e || '知名度 ' + r.fame}</span>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="card">
    <h2>${timeStr()} 賽程</h2>
    <p class="sub">${h.name}｜知名度 ${h.fame}｜狀態 ${condStr(h.cond)}</p>
    <div class="rlist">${list}</div>
  </div>`;
}

window.openRace = id => {
  const h = G.horse, race = findRace(id);
  if (!race || elig(h, race)) return;
  if (!G.entries[id]) {
    const opps = genOpps(race, h), ent = [{ name: h.name, r: +basePerf(h, race).toFixed(1), sex: h.sex, me: 1 }, ...opps];
    calcOdds(ent);
    G.entries[id] = ent;
  }
  const ent = G.entries[id], bets = G.bets.filter(b => b.race === id);
  const rows = ent.map((e, i) => `<tr class="${e.me?'me':''}"><td>${i+1}</td><td>${e.name}${e.me?' ★':''}</td><td>${e.sex}</td><td>${e.win}</td><td>${e.pl}</td></tr>`).join('');
  const sel = k => `<select id="${k}">${ent.map((e, i) => `<option value="${i}">${i+1}. ${e.name}</option>`).join('')}</select>`;
  $('#sc-race').innerHTML = `<div class="card">
    <button class="sm" onclick="renderRace()">← 返回賽程</button>
    <h2><span class="g ${race.g}">${race.g}</span> ${race.n}</h2>
    <p class="sub">${race.v||CTRY[race.c]} · ${race.s}${race.d}m · ${race.field}頭 · 一着獎金 ${fmt(race.prize)}萬 · 騎乘難度 ${'★'.repeat(race.diff)}</p>
    <div class="grid2">
      <div>
        <h3>出走表</h3>
        <table class="tbl entries"><tr><th>#</th><th>馬名</th><th>性</th><th>獨贏</th><th>位置</th></tr>${rows}</table>
      </div>
      <div>
        <h3>投注 <small>積分 ${fmt(G.pts)}</small></h3>
        <div class="betform">
          <label>類型 <select id="bt" onchange="document.getElementById('b2w').style.display=this.value==='quin'?'':'none'"><option value="win">獨贏（第1名）</option><option value="place">位置（前3名）</option><option value="quin">連贏（前2名不分先後）</option></select></label>
          <label>馬匹 ${sel('b1')}</label>
          <label id="b2w" style="display:none">第二匹 ${sel('b2')}</label>
          <label>金額 <input id="ba" type="number" min="50" max="2000" step="50" value="200"></label>
          <button onclick="placeBet('${id}')">下注</button>
        </div>
        <ul class="bets">${bets.map((b, i) => `<li>${b.desc} <b>${b.amt}</b> @${b.o} <a onclick="cancelBet(${i})">✕</a></li>`).join('') || '<li class="sub">尚未下注（可下注最多3項，每項上限2000）</li>'}</ul>
        <button class="gold big" onclick="startRace('${id}')">開始比賽</button>
      </div>
    </div>
  </div>`;
};

window.placeBet = id => {
  const ent = G.entries[id], t = $('#bt').value, a = +$('#b1').value, b = +$('#b2').value, amt = clamp(Math.floor(+$('#ba').value / 50) * 50, 50, 2000);
  if (G.bets.length >= 3) return toast('最多3項投注');
  if (G.pts < amt) return toast('積分不足');
  if (t === 'quin' && a === b) return toast('連贏需選兩匹不同的馬');
  const o = t === 'win' ? ent[a].win : t === 'place' ? ent[a].pl : quinOdds(ent[a], ent[b]);
  const desc = t === 'win' ? `獨贏 ${a+1}.${ent[a].name}` : t === 'place' ? `位置 ${a+1}.${ent[a].name}` : `連贏 ${a+1}-${b+1}`;
  G.pts -= amt;
  G.bets.push({ race: id, t, a, b, amt, o, desc });
  openRace(id);
};

window.cancelBet = i => {
  const b = G.bets[i];
  G.pts += b.amt;
  G.bets.splice(i, 1);
  openRace(b.race);
};

window.startRace = id => {
  const h = G.horse, race = findRace(id);
  diceModal(h, luck => rhythmGame(race.diff, h, (rb, rs) => {
    const rows = simRace(race, G.entries[id], h, luck, rb);
    raceAnim(race, rows, () => raceResult(race, rows, luck, rb, rs));
  }));
};

function raceResult(race, rows, luck, rb, rs) {
  const h = G.horse, te = traitE(h), me = rows.find(r => r.me), pos = me.pos, ent = G.entries[race.id], order = rows.map(r => r.i);
  const prize = Math.round(race.prize * ([1, .4, .25, .15, .1][pos - 1] || 0) * (te.prize || 1)),
        pmul = [1, .5, .3][pos - 1] || 0.1,
        fg = Math.max(1, Math.round((FAME_GAIN[race.g] + race.lv * 4) * pmul * (te.fame || 1))),
        ptsG = Math.round((PTS_GAIN[race.g][pos - 1] || 0) * (1 + race.lv * 0.3));

  h.starts++;
  h.earn += prize;
  h.fame += fg;
  G.pts += ptsG;
  if (pos === 1) {
    h.wins++;
    h.streak++;
    h.maxStreak = Math.max(h.maxStreak, h.streak);
    G.hist.wins++;
    if (race.g === 'G1') {
      G.hist.g1++;
      G.daily.g1A = 1;
    }
    if (ent[0].win >= 20) h.flags.darkwin = 1;
    if (rows[1] && rows[1].mg === '鼻') h.flags.nose = 1;
    if (h.flags.dice2) h.flags.dice2win = 1;
  } else {
    h.streak = 0;
    if (pos === 2) h.p2++;
    if (pos === 3) h.p3++;
  }
  h.last = pos;
  h.res.push({ n: race.n, g: race.g, pos, time: fmtTime(me.time), year: G.year, age: h.age, c: race.c, d: race.d, s: race.s, field: race.field, lv: race.lv, v: race.v });

  let net = 0;
  const bl = G.bets.map(b => {
    let w = 0;
    if (b.t === 'win' && order[0] === b.a) w = b.amt * b.o;
    else if (b.t === 'place' && order.slice(0, 3).includes(b.a)) w = b.amt * b.o;
    else if (b.t === 'quin' && order.slice(0, 2).includes(b.a) && order.slice(0, 2).includes(b.b)) w = b.amt * b.o;
    w = Math.round(w);
    G.pts += w;
    net += w - b.amt;
    if (w >= 5000) h.flags.bigbet = 1;
    return `<li>${b.desc} ${b.amt} → <b class="${w?'up':'down'}">${w?'+'+fmt(w):'落空'}</b></li>`;
  }).join('');
  G.bets = [];

  const na = checkAchv(h);
  const tbl = rows.map(r => `<tr class="${r.me?'me':''}"><td>${r.pos}</td><td>${r.i+1}</td><td>${r.name}</td><td>${fmtTime(r.time)}</td><td>${r.mg}</td></tr>`).join('');
  modal(`<h2>${race.n} 結果</h2>
    <div class="result-head ${pos===1?'win':''}">
      <div class="pos">${pos}<small>着</small></div>
      <div>
        <p>${h.name}｜${fmtTime(me.time)}｜運氣 ${luck>=0?'+':''}${luck.toFixed(1)}｜騎乘 +${rb}</p>
        <p>獎金 <b>${fmt(prize)}萬</b>　知名度 <b class="up">+${fg}</b>　積分 <b class="up">+${ptsG}</b>${bl?`　投注淨收益 <b class="${net>=0?'up':'down'}">${net>=0?'+':''}${fmt(net)}</b>`:''}</p>
      </div>
    </div>
    ${bl ? `<ul class="bets">${bl}</ul>` : ''}
    ${na.length ? `<p class="achv-new">🏆 新成就：${na.join('、')}</p>` : ''}
    <div class="scroll"><table class="tbl"><tr><th>着</th><th>#</th><th>馬名</th><th>時間</th><th>差距</th></tr>${tbl}</table></div>
    <button class="gold" onclick="closeModal();advance()">繼續</button>`, 'res-box');
}

function checkAchv(h) {
  const n = [];
  ACHV.forEach(a => {
    try {
      if (a.c(h)) {
        if (!h.achv.includes(a.id)) h.achv.push(a.id);
        if (!G.achv.includes(a.id)) {
          G.achv.push(a.id);
          n.push(a.n);
        }
      }
    } catch(e) {}
  });
  return n;
}

// ===== 退役 =====
function confirmRetire() {
  const h = G.horse;
  modal(`<h2>讓 ${h.name} 退役？</h2><p class="story">退役後將產生生涯記錄，並可作為繁殖用途。此操作無法復原。</p><button class="danger" onclick="closeModal();retireHorse()">確定退役</button> <button onclick="closeModal()">取消</button>`);
}

function retireHorse(next) {
  const h = G.horse;
  h.retired = 1;
  h.retYear = G.year;
  if (!h.peak) h.peak = { r: rating(h), st: { ...h.st } };
  h.score = careerScore(h);
  h.rank = careerRank(h.score);
  h.title = careerTitle(h);
  h.votes = hofVotes(h);
  checkAchv(h);
  G.hist.bestScore = Math.max(G.hist.bestScore, h.score);

  const url = drawCareer(h), ach = h.achv.map(id => ACHV.find(a => a.id === id)).filter(Boolean), hof = Object.entries(h.votes).filter(([, v]) => v > 0);
  modal(`<h2>退役儀式 · ${h.name}</h2>
    <div class="career">
      <img src="${url}" alt="career">
      <div>
        <div class="bigrank r-${h.rank}">${h.rank}</div>
        <p class="score">${fmt(h.score)} 分</p>
        <p class="title">「${h.title}」</p>
        <h3>顯彰馬投票</h3>
        <ul class="votes">${hof.length ? hof.map(([c, v]) => `<li>${c} <div class="bar"><i style="width:${v}%"></i></div> ${v}% ${v>=75?'<b class="up">入選</b>':''}</li>`).join('') : '<li class="sub">未達任何投票資格</li>'}</ul>
        <h3>獲得成就 (${ach.length})</h3>
        <div class="chips">${ach.map(a => `<span title="${a.d}">${a.n}</span>`).join('') || '<span class="sub">無</span>'}</div>
        <a class="btn" download="${h.name}_career.png" href="${url}">下載記錄圖片</a>
      </div>
    </div>
    <button class="gold" onclick="closeModal();nx()">結束儀式</button>`, 'ret-box');

  _next = () => {
    G.retired.push(h);
    G.horse = null;
    G.daily.finishA = 1;
    G.bets = [];
    save();
    if (next) next(); else show('hall');
  };
}

function drawCareer(h) {
  const c = document.createElement('canvas'), W = 820, H = 1180;
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#141a2b');
  g.addColorStop(1, '#0b0e17');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = '#c9a24d';
  x.lineWidth = 3;
  x.strokeRect(18, 18, W - 36, H - 36);
  x.lineWidth = 1;
  x.strokeRect(26, 26, W - 52, H - 52);

  const T = (t, px, py, sz, col = '#eee', f = 'Noto Serif TC', al = 'left', b = '') => {
    x.font = `${b} ${sz}px "${f}",serif`;
    x.fillStyle = col;
    x.textAlign = al;
    x.fillText(t, px, py);
  };

  T('CAREER RECORD', W / 2, 64, 16, '#c9a24d', 'Noto Sans TC', 'center');
  T(h.name, W / 2, 118, 44, '#fff', 'Noto Serif TC', 'center', 'bold');
  T(`${h.sex} · ${h.born}年生 · ${h.retYear}年退役 (${h.age}歲) · 父 ${h.sire} / 母 ${h.dam}`, W / 2, 150, 14, '#aab', 'Noto Sans TC', 'center');
  const t = h.trait != null ? TRAITS[h.trait].n : '—';
  T(`特性：${t}　成長型：${h.gr}　資質：${'★'.repeat(h.tal)}${'☆'.repeat(5-h.tal)}`, W / 2, 174, 14, '#aab', 'Noto Sans TC', 'center');

  x.fillStyle = 'rgba(201,162,77,0.12)';
  x.fillRect(50, 195, W - 100, 70);
  T(`${h.starts}戰 ${h.wins}勝`, 80, 238, 30, '#fff', 'Noto Serif TC', 'left', 'bold');
  T(`[${h.wins}-${h.p2}-${h.p3}-${h.starts-h.wins-h.p2-h.p3}]`, 300, 238, 18, '#c9a24d', 'Noto Sans TC');
  T(`獲得獎金 ${fmt(h.earn)}萬`, W - 80, 238, 18, '#fff', 'Noto Sans TC', 'right');

  T('PEAK ABILITY', 60, 300, 13, '#c9a24d', 'Noto Sans TC');
  STATS.forEach(([k, l], i) => {
    const cx = 60 + (i % 2) * 380, cy = 320 + Math.floor(i / 2) * 30, v = h.peak.st[k];
    T(l, cx, cy + 14, 14, '#ddd', 'Noto Sans TC');
    x.fillStyle = '#2a3350';
    x.fillRect(cx + 50, cy + 2, 260, 14);
    x.fillStyle = v >= 80 ? '#e0b84a' : v >= 60 ? '#6bb8ff' : '#7fa88a';
    x.fillRect(cx + 50, cy + 2, 260 * v / 100, 14);
    T(v, cx + 320, cy + 14, 14, '#fff', 'Noto Sans TC');
  });

  T('MAJOR WINS', 60, 500, 13, '#c9a24d', 'Noto Sans TC');
  const gw = h.res.filter(r => r.pos === 1 && ['G1', 'G2', 'G3', 'OP'].includes(r.g)).sort((a, b) => ({ G1: 0, G2: 1, G3: 2, OP: 3 }[a.g] - { G1: 0, G2: 1, G3: 2, OP: 3 }[b.g])).slice(0, 10);
  if (!gw.length) T('（無重賞/公開賽勝利）', 60, 528, 14, '#889', 'Noto Sans TC');
  gw.forEach((r, i) => {
    const cy = 528 + i * 24;
    x.fillStyle = { G1: '#c9a24d', G2: '#8fa3c7', G3: '#a67c52', OP: '#666' }[r.g];
    x.fillRect(60, cy - 14, 34, 18);
    T(r.g, 77, cy, 11, '#000', 'Noto Sans TC', 'center', 'bold');
    T(`${r.n}（${r.age}歲 · ${CTRY[r.c]} ${r.s}${r.d}m · ${r.time}）`, 104, cy, 14, '#eee', 'Noto Sans TC');
  });

  const rc = { SSS: '#ff5e78', SS: '#ffb347', S: '#e0b84a', A: '#c77dff', B: '#6bb8ff', C: '#7fd39b', D: '#aaa', E: '#888', F: '#666' }[h.rank];
  x.fillStyle = 'rgba(255,255,255,0.04)';
  x.fillRect(50, 780, W - 100, 150);
  T('CAREER SCORE', 80, 812, 13, '#c9a24d', 'Noto Sans TC');
  T(fmt(h.score), 80, 870, 48, '#fff', 'Noto Serif TC', 'left', 'bold');
  T(`「${h.title}」`, 80, 910, 20, '#c9a24d', 'Noto Serif TC');
  T(h.rank, W - 90, 895, 96, rc, 'Noto Serif TC', 'right', 'bold');

  T('HALL OF FAME VOTES', 60, 965, 13, '#c9a24d', 'Noto Sans TC');
  Object.entries(h.votes).forEach(([cn, v], i) => {
    const cx = 60 + (i % 4) * 190, cy = 990 + Math.floor(i / 4) * 44;
    T(cn, cx, cy, 14, '#ddd', 'Noto Sans TC');
    x.fillStyle = '#2a3350';
    x.fillRect(cx, cy + 8, 150, 10);
    x.fillStyle = v >= 75 ? '#e0b84a' : '#556';
    x.fillRect(cx, cy + 8, 150 * v / 100, 10);
    T(v ? `${v}%${v>=75?' 入選':''}` : '無資格', cx + 155, cy + 16, 11, v >= 75 ? '#e0b84a' : '#889', 'Noto Sans TC');
  });

  T(`成就 ${h.achv.length} 項`, 60, 1110, 13, '#c9a24d', 'Noto Sans TC');
  T(h.achv.map(id => (ACHV.find(a => a.id === id) || {}).n).filter(Boolean).slice(0, 12).join(' · '), 60, 1135, 12, '#aab', 'Noto Sans TC');
  T('疾風競馬 · Gallop Legend', W / 2, 1160, 11, '#556', 'Noto Sans TC', 'center');
  return c.toDataURL('image/png');
}

// ===== 繁殖 =====
function renderBreed() {
  const el = $('#sc-breed'), own = G.retired;
  if (!own.length) {
    el.innerHTML = '<div class="card empty"><h2>繁殖</h2><p>需要至少一匹自己的退役馬才能開始繁殖。退役馬可與自己或他人的馬配種。</p></div>';
    return;
  }
  const opt = (arr, own) => arr.map((h, i) => `<option value="${own?'o':'s'}${i}">${h.name} (${own?`${h.rank}級 ${Math.round(h.peak.r)}`:`能力${h.r} · ${fmt(h.p)}積分`})</option>`).join('');
  const sires = own.filter(h => h.sex === '牡'), dams = own.filter(h => h.sex === '牝');
  el.innerHTML = `<div class="card">
    <h2>繁殖 <small>自己的馬免費，他人的馬需付種馬費</small></h2>
    ${G.horse ? '<p class="warn">目前已有現役馬，退役後才可繁殖新馬。</p>' : ''}
    <div class="grid2">
      <label>父馬<select id="sire"><optgroup label="自己的退役馬">${opt(sires, 1) || '<option disabled>無</option>'}</optgroup><optgroup label="他人的種馬">${opt(STUD.filter(s => s.s === '牡'), 0)}</optgroup></select></label>
      <label>母馬<select id="dam"><optgroup label="自己的退役馬">${opt(dams, 1) || '<option disabled>無</option>'}</optgroup><optgroup label="他人的繁殖牝馬">${opt(STUD.filter(s => s.s === '牝'), 0)}</optgroup></select></label>
    </div>
    <p class="sub">好的父母能提高後代的期望，但不保證出好馬；資質仍有很大隨機性。</p>
    <button class="gold" ${G.horse ? 'disabled' : ''} onclick="breed()">配種</button>
  </div>`;
}

window.breed = () => {
  if (G.horse) return;
  const get = (v, sex) => {
    if (!v) return null;
    if (v[0] === 'o') {
      const h = G.retired.filter(x => x.sex === sex)[+v.slice(1)];
      return { name: h.name, st: h.peak.st, tal: h.tal, dmin: h.dmin, dmax: h.dmax, turf: h.turf, dirt: h.dirt, p: 0 };
    }
    const s = STUD.filter(x => x.s === sex)[+v.slice(1)], st = {};
    STATS.forEach(([k]) => st[k] = clamp(s.r + R(-8, 8), 20, 99));
    return {
      name: s.name || s.n, st,
      tal: s.r >= 88 ? 5 : s.r >= 82 ? 4 : s.r >= 76 ? 3 : 2,
      dmin: pick([1200, 1400, 1600, 1800]),
      dmax: pick([2000, 2200, 2400, 2600, 3000]),
      turf: R(70, 100),
      dirt: R(30, 100),
      p: s.p
    };
  };

  const sv = $('#sire').value, dv = $('#dam').value, S = get(sv, '牡'), D = get(dv, '牝');
  if (!S || !D) return toast('請選擇父馬與母馬');
  const cost = S.p + D.p;
  if (G.pts < cost) return toast(`積分不足（需要${fmt(cost)}）`);
  G.pts -= cost;

  const base = {};
  STATS.forEach(([k]) => base[k] = (S.st[k] + D.st[k]) / 2 * 0.62);
  const tal = clamp(Math.round((S.tal + D.tal) / 2 + RF(-1.6, 1.4)), 1, 5);
  const f = mkHorse(Math.random() < 0.5 ? '牡' : '牝', 0, tal, {
    base, sire: S.name, dam: D.name,
    dmin: clamp(Math.round((S.dmin + D.dmin) / 2 / 200) * 200 + pick([-200, 0, 0, 200]), 1000, 2400),
    dmax: clamp(Math.round((S.dmax + D.dmax) / 2 / 200) * 200 + pick([-200, 0, 0, 200]), 1400, 3400),
    turf: clamp(Math.round((S.turf + D.turf) / 2 + R(-10, 10)), 40, 100),
    dirt: clamp(Math.round((S.dirt + D.dirt) / 2 + R(-10, 10)), 20, 100)
  });
  if (f.dmax <= f.dmin) f.dmax = f.dmin + 400;
  f.born = G.year - 2;
  acquire(f);
};

// ===== 名馬堂 / 任務 / 成就 =====
function renderHall() {
  const el = $('#sc-hall');
  el.innerHTML = `<div class="card">
    <h2>名馬堂 <small>培育 ${G.hist.horses} 匹 · 總勝利 ${G.hist.wins} · G1 ${G.hist.g1} · 最高分 ${fmt(G.hist.bestScore)}</small></h2>
    ${G.retired.length ? `<table class="tbl">
      <tr><th>馬名</th><th>性</th><th>成績</th><th>G1</th><th>獎金</th><th>評級</th><th>稱號</th><th></th></tr>
      ${G.retired.map((h, i) => `<tr>
        <td>${h.name}</td>
        <td>${h.sex}</td>
        <td>${h.starts}戰${h.wins}勝</td>
        <td>${g1w(h)}</td>
        <td>${fmt(h.earn)}萬</td>
        <td class="r-${h.rank}"><b>${h.rank}</b> ${fmt(h.score)}</td>
        <td>${h.title}</td>
        <td><button class="sm" onclick="viewCareer(${i})">記錄</button></td>
      </tr>`).join('')}
    </table>` : '<p class="sub">尚無退役馬。</p>'}
  </div>`;
}

window.viewCareer = i => {
  const h = G.retired[i], url = drawCareer(h);
  modal(`<h2>${h.name} 生涯記錄</h2><img class="full" src="${url}"><br><a class="btn" download="${h.name}_career.png" href="${url}">下載</a> <button onclick="closeModal()">關閉</button>`, 'ret-box');
};

function dailyReset() {
  const d = G.daily;
  if (d.date !== today()) {
    d.date = today();
    d.login = 0;
    d.finish = 0;
    d.g1 = 0;
    d.finishA = 0;
    d.g1A = 0;
  }
}

function renderDaily() {
  dailyReset();
  const d = G.daily,
        row = (n, desc, rw, avail, done, k) => `<div class="task ${done?'done':''}">
          <div><b>${n}</b><small>${desc}</small></div>
          <span>${rw} 積分</span>
          <button ${done || !avail ? 'disabled' : ''} onclick="claim('${k}',${rw})">${done ? '已領取' : avail ? '領取' : '未完成'}</button>
        </div>`;
  $('#sc-daily').innerHTML = `<div class="card">
    <h2>每日任務 <small>${d.date}</small></h2>
    ${row('每日登入', '今天打開遊戲', 300, 1, d.login, 'login')}
    ${row('養成一匹馬', '今天讓一匹馬退役', 1000, d.finishA, d.finish, 'finish')}
    ${row('勝出G1賽事', '今天贏得任何一場G1', 500, d.g1A, d.g1, 'g1')}
  </div>`;
}

window.claim = (k, rw) => {
  if (G.daily[k]) return;
  G.daily[k] = 1;
  G.pts += rw;
  SFX.win();
  toast(`獲得 ${rw} 積分`);
  render();
};

function renderAchv() {
  $('#sc-achv').innerHTML = `<div class="card">
    <h2>成就 <small>${G.achv.length} / ${ACHV.length}</small></h2>
    <div class="agrid">${ACHV.map(a => `<div class="ach ${G.achv.includes(a.id)?'got':''}"><b>${a.n}</b><small>${a.d}</small></div>`).join('')}</div>
    <p class="sub" style="margin-top:12px"><button class="danger sm" onclick="resetGame()">重設遊戲</button></p>
  </div>`;
}

window.resetGame = () => {
  if (confirm('確定刪除所有進度？')) {
    localStorage.removeItem('gl_save');
    location.reload();
  }
};

// ===== 初始化 =====
load();
dailyReset();
if (!G.daily.login) toast('每日登入獎勵可在「任務」領取');
document.querySelectorAll('nav button').forEach(b => b.onclick = () => show(b.dataset.s));
show('home');
