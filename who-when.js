/* Спільне для index.html і dates.html: дані з Firebase, найкращі проміжки, таблиця «хто коли». */
(function(){
  const DB = "https://norway-dates-default-rtdb.europe-west1.firebasedatabase.app";
  const PATH = "norway2027";
  const START = new Date(2027, 2, 1), END = new Date(2027, 2, 31);
  const MON_GEN = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
  const MON_NOM = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
  const pad = n => String(n).padStart(2,"0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const DAYS = (() => { const a=[]; for (let d=new Date(START); d<=END; d.setDate(d.getDate()+1)) a.push(iso(d)); return a; })();
  const fmt = k => { const [,m,d]=k.split("-").map(Number); return `${d} ${MON_GEN[m-1]}`; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  async function load(){
    const r = await fetch(`${DB}/${PATH}/people.json`);
    if (!r.ok) throw new Error(r.status);
    return (await r.json()) || {};
  }

  /* Найкращі проміжки тривалістю len: спершу ті, де ніхто не має ✗, далі де більше людей відмітили «можу» на всі дні. */
  function windows(people, len, limit = 4){
    const list = Object.values(people).filter(p => p.days && Object.keys(p.days).length);
    const res = [];
    for (let i=0; i+len<=DAYS.length; i++){
      const span = DAYS.slice(i, i+len);
      const free=[], maybe=[], busy=[]; let yesDays=0;
      for (const p of list){
        let bad=false, all=true;
        for (const k of span){ const v=p.days[k]; if(v==="n") bad=true; else if(v==="y") yesDays++; else all=false; }
        (bad?busy:all?free:maybe).push(p.name);
      }
      res.push({i, start:span[0], end:span[len-1], span, free, maybe, busy, yesDays});
    }
    res.sort((a,b)=> a.busy.length-b.busy.length || b.free.length-a.free.length || b.yesDays-a.yesDays || a.i-b.i);
    const picked=[];
    for (const w of res){
      if (picked.length>=limit) break;
      if (picked.every(q => Math.abs(q.i-w.i) >= Math.max(2, Math.ceil(len/2)))) picked.push(w);
    }
    return {picked, total:list.length};
  }

  /* Найдовші суцільні проміжки, де найменше людей поставили ✗ (в ідеалі ніхто).
     Для кожного: хто ✓ на всі дні, хто не все відмітив, хто має ✗,
     і core — найдовша частина, де ✓ ставить найбільше людей. */
  function ranges(people, limit = 3){
    const list = Object.values(people).filter(p => p.days && Object.keys(p.days).length);
    if (!list.length) return {picked: [], total: 0};
    const busy = DAYS.map(k => list.filter(p => p.days[k] === "n").length);
    const yes  = DAYS.map(k => list.filter(p => p.days[k] === "y").length);
    const minB = Math.min(...busy);
    const runs = [];
    for (let i = 0; i < DAYS.length; i++){
      if (busy[i] !== minB) continue;
      let j = i; while (j + 1 < DAYS.length && busy[j + 1] === minB) j++;
      const span = DAYS.slice(i, j + 1);
      const free = [], maybe = [], bad = [];
      for (const p of list){
        const vals = span.map(k => p.days[k]);
        (vals.includes("n") ? bad : vals.every(v => v === "y") ? free : maybe).push(p.name);
      }
      // ядро: найдовша частина з максимальною кількістю ✓
      const maxY = Math.max(...yes.slice(i, j + 1));
      let core = null;
      for (let a = i; a <= j; a++){
        if (yes[a] !== maxY) continue;
        let b = a; while (b + 1 <= j && yes[b + 1] === maxY) b++;
        if (!core || b - a > core.end - core.start) core = {start: a, end: b};
        a = b;
      }
      runs.push({i, start: span[0], end: span[span.length - 1], span, len: span.length,
        free, maybe, busy: bad, yesDays: yes.slice(i, j + 1).reduce((s, v) => s + v, 0),
        core: core && {start: DAYS[core.start], end: DAYS[core.end], len: core.end - core.start + 1, yes: maxY}});
      i = j;
    }
    runs.sort((a, b) => b.len - a.len || b.yesDays - a.yesDays || a.i - b.i);
    return {picked: runs.slice(0, limit), total: list.length};
  }

  const CSS = `
  .ww-scroll{position:relative;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line,#e6e6e6);border-radius:12px;background:var(--card,#fff)}
  .ww{display:grid;gap:2px;padding:10px 10px 10px 0;min-width:max-content;font-size:12px}
  .ww>div{min-width:0}
  .ww-name{position:sticky;left:0;z-index:1;background:var(--card,#fff);padding:0 10px;display:flex;align-items:center;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}
  button.ww-name{font:inherit;font-weight:600;border:0;color:inherit;cursor:pointer;text-align:left}
  button.ww-name:hover{color:var(--accent,#e0435e)}
  .ww-mon{font-weight:700;font-size:11px;color:var(--muted,#6a6a6a);padding-left:2px;white-space:nowrap;border-left:1px solid var(--line,#e6e6e6)}
  .ww-dn{font-size:9.5px;text-align:center;color:var(--muted,#6a6a6a);font-variant-numeric:tabular-nums;border-radius:3px;line-height:16px}
  .ww-dn.we{color:var(--accent,#e0435e);font-weight:700}
  .ww-dn.hl{background:var(--accent,#e0435e);color:#fff}
  .ww-c{height:20px;border-radius:3px;background:var(--line,#e6e6e6);opacity:.55}
  .ww-c.y{background:#2e9e6a;opacity:1}
  .ww-c.n{background:#d64545;opacity:1}
  .ww-c.hl{box-shadow:inset 0 0 0 2px var(--accent,#e0435e)}
  .ww-tot{height:22px;border-radius:3px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;color:var(--fg,#222);background:transparent}
  .ww-tot.n{color:#d64545}
  .ww-tot.hl{outline:2px solid var(--accent,#e0435e);outline-offset:-2px}
  .ww-sep{grid-column:1/-1;height:1px;background:var(--line,#e6e6e6);margin:3px 0}
  .ww-empty{padding:14px;color:var(--muted,#6a6a6a);font-size:14px}
  .ww-key{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--muted,#6a6a6a)}
  .ww-key span{display:inline-flex;align-items:center;gap:5px}
  .ww-key i{width:12px;height:12px;border-radius:3px;display:inline-block}`;
  let cssDone = false;

  /* Таблиця: рядок на людину, колонка на день. opts.highlight — Set дат, opts.onName(key) — клік по імені. */
  function timeline(container, people, opts = {}){
    if (!cssDone){ const s=document.createElement("style"); s.textContent=CSS; document.head.appendChild(s); cssDone=true; }
    const hl = opts.highlight || new Set();
    const list = Object.entries(people).sort((a,b)=>a[1].name.localeCompare(b[1].name,"uk"));
    if (!list.length){ container.innerHTML = `<div class="ww-scroll"><div class="ww-empty">Поки ніхто не відмітив дати.</div></div>`; return; }
    const N = DAYS.length;
    let h = `<div class="ww-scroll"><div class="ww" style="grid-template-columns:auto repeat(${N}, minmax(14px, 1fr))">`;
    // місяці
    h += `<div class="ww-name"></div>`;
    let i = 0;
    while (i < N){
      const m = DAYS[i].slice(0,7); let j = i; while (j < N && DAYS[j].slice(0,7) === m) j++;
      h += `<div class="ww-mon" style="grid-column:span ${j-i}">${j-i>=4?MON_NOM[+m.slice(5)-1]:""}</div>`; i = j;
    }
    // числа
    h += `<div class="ww-name"></div>`;
    for (const k of DAYS){
      const wd = new Date(k+"T12:00").getDay();
      h += `<div class="ww-dn${wd===0||wd===6?" we":""}${hl.has(k)?" hl":""}">${+k.slice(8)}</div>`;
    }
    // люди
    for (const [key, p] of list){
      h += opts.onName ? `<button type="button" class="ww-name" data-k="${esc(key)}" title="Змінити дати: ${esc(p.name)}">${esc(p.name)}</button>` : `<div class="ww-name" title="${esc(p.name)}">${esc(p.name)}</div>`;
      for (const k of DAYS){
        const v = p.days?.[k];
        h += `<div class="ww-c${v==="y"?" y":v==="n"?" n":""}${hl.has(k)?" hl":""}" title="${esc(p.name)} · ${fmt(k)}: ${v==="y"?"можу":v==="n"?"не можу":"не відмічено"}"></div>`;
      }
    }
    // разом
    h += `<div class="ww-sep"></div><div class="ww-name">Можуть</div>`;
    for (const k of DAYS){
      let y=0, n=0; for (const [,p] of list){ const v=p.days?.[k]; if(v==="y")y++; else if(v==="n")n++; }
      h += `<div class="ww-tot${n?" n":""}${hl.has(k)?" hl":""}" title="${fmt(k)}: ✓ ${y} · ✗ ${n}">${n?"✗":y||""}</div>`;
    }
    h += `</div></div><div class="ww-key"><span><i style="background:#2e9e6a"></i>можу</span><span><i style="background:#d64545"></i>не можу</span><span><i style="background:var(--line,#e6e6e6);opacity:.55"></i>не відмічено</span><span>Нижній рядок: скільки людей можуть, ✗ = хтось не може</span></div>`;
    container.innerHTML = h;
    const first = container.querySelector(".ww-dn.hl");
    if (first) container.querySelector(".ww-scroll").scrollLeft = Math.max(0, first.offsetLeft - 150);
    if (opts.onName) container.querySelectorAll("button.ww-name").forEach(b => b.onclick = () => opts.onName(b.dataset.k));
  }

  window.WhoWhen = { DB, PATH, DAYS, fmt, esc, load, windows, ranges, timeline };
})();
