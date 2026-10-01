/* Concurso MTOP 0048/2026 – App de estudio (vanilla JS, sin dependencias) */
'use strict';

const MODULE_FILES = ['const', 'd500a', 'd500b', 'd222', 'tocaf', 'tofupa', 'tofupb'];
const SYLLABUS = [
  { label: 'Constitución de la República: arts. 82-85, 88-103, 149-168 y 233', mods: ['const'] },
  { label: 'Decreto Nº 500/991', mods: ['d500a', 'd500b'] },
  { label: 'Decreto Nº 222/014 – Reglamentación de la Ley Nº 19.121 (régimen disciplinario)', mods: ['d222'] },
  { label: 'TOCAF – arts. 26-79', mods: ['tocaf'] },
  { label: 'TOFUP – arts. 1018-1236', mods: ['tofupa', 'tofupb'] },
];
const NAV_NAMES = { const: 'Constitución', d500a: 'Dec. 500/991 · Parte 1', d500b: 'Dec. 500/991 · Parte 2', d222: 'Dec. 222/014', tocaf: 'TOCAF 26-79', tofupa: 'TOFUP 1018-1103', tofupb: 'TOFUP 1104-1236' };
const SUPPORT = {
  bank: 'BROU', holder: 'Gastón Maldonado',
  accounts: [
    { label: 'Número de cuenta actual', value: '001798427-00001' },
    { label: 'Número de cuenta anterior', value: '190-0830950' },
    { label: 'Para transferencias desde otros bancos', value: '00179842700001' },
  ],
};
const EXAM_START = new Date('2026-10-26T00:00:00-03:00');
const STORE_KEY = 'mtop0048:v1';
const DAY = 86400000;
const INTERVALS = [0, 1, 2, 4, 8, 16, 32]; // días por caja (Leitner)

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paras = (s) => esc(s).split(/\n+/).filter(Boolean).map((p) => `<p>${p}</p>`).join('');
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const plural = (n, s, p) => `${n} ${n === 1 ? s : p || s + 's'}`;
function highlight(text, q) {
  const safe = esc(text);
  if (!q) return safe;
  const terms = norm(q).split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return safe;
  // resaltado insensible a tildes: mapeamos posiciones sobre el texto normalizado
  const n = norm(text);
  const marks = [];
  for (const t of terms) { let i = 0; while ((i = n.indexOf(t, i)) !== -1) { marks.push([i, i + t.length]); i += t.length; } }
  if (!marks.length) return safe;
  marks.sort((a, b) => a[0] - b[0]);
  let out = '', pos = 0;
  for (const [s, e] of marks) { if (s < pos) continue; out += esc(text.slice(pos, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>'; pos = e; }
  return out + esc(text.slice(pos));
}

/* ---------- estado persistente (sólo en este navegador) ---------- */
const state = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { s = {}; }
  return Object.assign({ srs: {}, qs: {}, studied: {}, read: {}, exams: [], theme: null }, s);
})();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ } }, 150);
}

/* ---------- datos ---------- */
const DB = { mods: [], modById: {}, topicById: {}, cards: [], questions: [], deadlines: [], glossary: [], mnemonics: [], articles: [] };

async function loadData() {
  const mods = await Promise.all(MODULE_FILES.map((id) => fetch(`data/${id}.json`).then((r) => { if (!r.ok) throw new Error(id); return r.json(); })));
  for (const m of mods) {
    DB.mods.push(m); DB.modById[m.id] = m;
    for (const t of m.topics) {
      t._mid = m.id; DB.topicById[t.id] = t;
      for (const a of t.articles) DB.articles.push({ ...a, tid: t.id, mid: m.id });
      t.flashcards.forEach((c, i) => DB.cards.push({ ...c, key: `${t.id}#f${i}`, tid: t.id, mid: m.id }));
      t.questions.forEach((q, i) => DB.questions.push({ ...q, key: `${t.id}#q${i}`, tid: t.id, mid: m.id }));
    }
    (m.deadlines || []).forEach((d) => DB.deadlines.push({ ...d, mid: m.id }));
    (m.glossary || []).forEach((d) => DB.glossary.push({ ...d, mid: m.id }));
    (m.mnemonics || []).forEach((d) => DB.mnemonics.push({ ...d, mid: m.id }));
  }
}
const modLabel = (mid) => NAV_NAMES[mid] || DB.modById[mid]?.shortTitle || mid;
const artLabel = (mid) => (mid === 'const' ? 'Art.' : 'Art.');
function scopeItems(scope, list) {
  if (!scope || scope === 'all') return list;
  if (scope.startsWith('m:')) { const ids = scope.slice(2).split(','); return list.filter((x) => ids.includes(x.mid)); }
  if (scope.startsWith('t:')) { const id = scope.slice(2); return list.filter((x) => x.tid === id); }
  return list;
}
function scopeName(scope) {
  if (!scope || scope === 'all') return 'Todo el temario';
  if (scope.startsWith('m:')) return scope.slice(2).split(',').map(modLabel).join(' + ');
  if (scope.startsWith('t:')) { const t = DB.topicById[scope.slice(2)]; return t ? `${t.title}` : scope; }
  return scope;
}

/* ---------- métricas ---------- */
function cardDue(key) { const r = state.srs[key]; return !r || r.due <= Date.now(); }
function cardBox(key) { return state.srs[key]?.b ?? -1; }
function topicStats(tid) {
  const t = DB.topicById[tid];
  const qs = t.questions.map((_, i) => state.qs[`${tid}#q${i}`]).filter(Boolean);
  const answered = qs.length, correct = qs.filter((r) => r.last === 1).length;
  const cards = t.flashcards.map((_, i) => cardBox(`${tid}#f${i}`));
  const learned = cards.filter((b) => b >= 2).length;
  const mastery = Math.round(((correct / (t.questions.length || 1)) * 0.6 + (learned / (t.flashcards.length || 1)) * 0.4) * 100);
  return { answered, correct, total: t.questions.length, learned, cards: t.flashcards.length, mastery, studied: !!state.studied[tid] };
}
function modStats(mid) {
  const m = DB.modById[mid];
  const ts = m.topics.map((t) => topicStats(t.id));
  const sum = (k) => ts.reduce((a, b) => a + b[k], 0);
  const mastery = Math.round(ts.reduce((a, b) => a + b.mastery, 0) / (ts.length || 1));
  return { topics: ts.length, studied: ts.filter((x) => x.studied).length, answered: sum('answered'), correct: sum('correct'), total: sum('total'), learned: sum('learned'), cards: sum('cards'), mastery };
}
function globalStats() {
  const ms = DB.mods.map((m) => modStats(m.id));
  const sum = (k) => ms.reduce((a, b) => a + b[k], 0);
  const due = DB.cards.filter((c) => state.srs[c.key] && cardDue(c.key)).length;
  const fresh = DB.cards.filter((c) => !state.srs[c.key]).length;
  const errors = DB.questions.filter((q) => state.qs[q.key]?.last === 0).length;
  return { topics: sum('topics'), studied: sum('studied'), answered: sum('answered'), correct: sum('correct'), total: sum('total'), learned: sum('learned'), cards: sum('cards'), mastery: Math.round(ms.reduce((a, b) => a + b.mastery, 0) / (ms.length || 1)), due, fresh, errors };
}

/* ---------- router ---------- */
const routes = [];
const route = (re, fn) => routes.push([re, fn]);
let cleanup = null;
function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path, params: new URLSearchParams(qs || '') };
}
function render() {
  if (cleanup) { try { cleanup(); } catch { /* noop */ } cleanup = null; }
  const { path, params } = parseHash();
  const main = $('#main');
  document.body.classList.remove('nav-open');
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      main.innerHTML = '';
      fn(main, m.slice(1).map(decodeURIComponent), params);
      markNav(path);
      const target = params.get('art');
      if (target) { const el = document.getElementById(`art-${target}`); if (el) { el.open = true; setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); } }
      else window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
      return;
    }
  }
  main.innerHTML = '<h1>Página no encontrada</h1><p><a href="#/">Volver al inicio</a></p>';
}
function markNav(path) {
  $$('.sidebar a').forEach((a) => {
    const href = a.getAttribute('href').replace(/^#/, '');
    a.classList.toggle('active', !!(href === path || (href !== '/' && path.startsWith(href + '/')) || (a.dataset.mod && path.startsWith(`/m/${a.dataset.mod}`)) || (a.dataset.mod && path.startsWith('/t/') && DB.topicById[path.slice(3)]?._mid === a.dataset.mod)));
  });
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

/* ---------- componentes ---------- */
function bar(p) { return `<div class="bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div>`; }
function practiceButtons(scope) {
  const s = encodeURIComponent(scope);
  return `<div class="row">
    <a class="btn primary" href="#/flash?scope=${s}">🃏 Flashcards</a>
    <a class="btn" href="#/quiz?scope=${s}&n=10">❓ 10 preguntas</a>
    <a class="btn" href="#/quiz?scope=${s}&n=0">📝 Todas las preguntas</a>
  </div>`;
}
function eli5Box(text) { return text ? `<div class="eli5"><span class="label">🧒 Explicado fácil (ELI5)</span>${paras(text)}</div>` : ''; }

/* ---------- vistas ---------- */
route(/^\/$/, (el) => {
  const g = globalStats();
  const days = Math.ceil((EXAM_START - Date.now()) / DAY);
  el.innerHTML = `
    <h1>Prueba de oposición – Gestor Administrativo MTOP</h1>
    <p class="lead">Llamado 0048/2026 · Administrativo V (Esc. C, Gdo. 01). La prueba vale <b>50 de 100 puntos</b> y se toma <b>del 26 al 30 de octubre de 2026</b>${days > 0 ? ` — faltan <b>${plural(days, 'día')}</b>` : ''}.</p>
    <div class="stats">
      <div class="stat"><b>${g.mastery}%</b><span>Dominio global</span>${bar(g.mastery)}</div>
      <div class="stat"><b>${g.studied}/${g.topics}</b><span>Temas leídos</span>${bar(pct(g.studied, g.topics))}</div>
      <div class="stat"><b>${g.learned}/${g.cards}</b><span>Flashcards aprendidas</span>${bar(pct(g.learned, g.cards))}</div>
      <div class="stat"><b>${g.correct}/${g.total}</b><span>Preguntas acertadas</span>${bar(pct(g.correct, g.total))}</div>
    </div>
    <div class="row">
      <a class="btn primary" href="#/flash?scope=all">🃏 Repasar flashcards${g.due ? ` (${g.due} pendientes)` : ''}</a>
      <a class="btn" href="#/quiz?scope=all&n=20">❓ 20 preguntas al azar</a>
      <a class="btn" href="#/examen">⏱️ Simulacro</a>
      ${g.errors ? `<a class="btn warn" href="#/errores">🔁 Repasar ${plural(g.errors, 'error', 'errores')}</a>` : ''}
    </div>
    <h2>Bibliografía oficial (Acta N° 1)</h2>
    ${SYLLABUS.map((s) => `
      <div class="card">
        <b>${esc(s.label)}</b>
        <div class="grid" style="margin-top:10px">
          ${s.mods.map((mid) => { const m = DB.modById[mid]; const st = modStats(mid); const arts = m.topics.reduce((a, t) => a + t.articles.length, 0); return `
            <a class="tile" href="#/m/${mid}">
              <h3>${esc(m.part ? m.part : m.shortTitle)}</h3>
              <p>${plural(m.topics.length, 'tema')} · ${plural(arts, 'artículo')} · ${st.cards} flashcards · ${st.total} preguntas</p>
              ${bar(st.mastery)}<p style="margin-top:4px">Dominio ${st.mastery}%</p>
            </a>`; }).join('')}
        </div>
      </div>`).join('')}
    <h2>Cómo usar la app</h2>
    <div class="card prose">
      <p><b>1. Leé</b> cada tema: resumen, explicación fácil (ELI5), puntos clave, trampas típicas y el texto literal de cada artículo. Marcá el tema como leído.</p>
      <p><b>2. Fijá</b> con flashcards: el sistema de repetición espaciada te vuelve a mostrar las que te cuestan y espacia las que ya sabés.</p>
      <p><b>3. Practicá</b> con preguntas (literales, de comprensión y casos prácticos) y repasá tus errores.</p>
      <p><b>4. Medí tu nivel</b> con simulacros cronometrados de todo el temario.</p>
      <p class="muted small">Tu progreso se guarda sólo en este navegador. Podés exportarlo o importarlo desde <a href="#/progreso">Mi progreso</a>.</p>
    </div>
    ${supportCard()}
    <footer class="foot">Contenido elaborado a partir de los textos oficiales (IMPO y ONSC). Material de estudio: ante cualquier duda, prevalece la norma oficial vigente.</footer>`;
});

route(/^\/ruta$/, (el) => {
  const order = ['const', 'd500a', 'd500b', 'd222', 'tofupa', 'tofupb', 'tocaf'];
  el.innerHTML = `<h1>Ruta de estudio sugerida</h1>
  <p class="lead">Un orden que va de lo general a lo específico. Tildá cada tema al terminarlo. Lo ideal: leer el tema, hacer sus flashcards y después sus preguntas.</p>
  <div class="notice">Tip: el Decreto 222/014 y el Libro VII del TOFUP (arts. 1018-1103) regulan lo mismo (régimen disciplinario); estudialos seguidos. Lo mismo pasa con los recursos del Decreto 500/991 y el Libro VIII del TOFUP.</div>
  ${order.map((mid, i) => { const m = DB.modById[mid]; return `<h2>${i + 1}. ${esc(modLabel(mid))}</h2>
    ${m.topics.map((t) => { const s = topicStats(t.id); return `<div class="card row" style="justify-content:space-between">
      <label class="chk" style="flex:1"><input type="checkbox" data-studied="${t.id}" ${s.studied ? 'checked' : ''}> <a href="#/t/${t.id}">${esc(t.title)}</a> <span class="muted small">${esc(t.range || '')}</span></label>
      <span class="pill ${s.mastery >= 70 ? 'ok' : s.mastery >= 30 ? 'warn' : ''}">Dominio ${s.mastery}%</span></div>`; }).join('')}`; }).join('')}`;
  el.addEventListener('change', (e) => { const id = e.target.dataset.studied; if (id) { state.studied[id] = e.target.checked; if (!e.target.checked) delete state.studied[id]; save(); buildNav(); } });
});

route(/^\/m\/([^/]+)$/, (el, [mid], params) => {
  const m = DB.modById[mid];
  if (!m) { el.innerHTML = '<p>Módulo no encontrado.</p>'; return; }
  const st = modStats(mid);
  const tab = params.get('tab') || 'temas';
  el.innerHTML = `
    <div class="crumbs"><a href="#/">Inicio</a> › ${esc(m.shortTitle)}</div>
    <h1>${esc(m.title)}</h1>
    <p class="lead">${plural(m.topics.length, 'tema')} · ${st.cards} flashcards · ${st.total} preguntas · Fuente: <a href="${esc(m.source?.url)}" target="_blank" rel="noopener">${esc(m.source?.name)}</a></p>
    <div class="stats">
      <div class="stat"><b>${st.mastery}%</b><span>Dominio</span>${bar(st.mastery)}</div>
      <div class="stat"><b>${st.studied}/${st.topics}</b><span>Temas leídos</span>${bar(pct(st.studied, st.topics))}</div>
      <div class="stat"><b>${st.correct}/${st.total}</b><span>Preguntas acertadas</span>${bar(pct(st.correct, st.total))}</div>
    </div>
    ${practiceButtons('m:' + mid)}
    <div class="tabs" role="tablist">
      ${[['temas', 'Temas'], ['resumen', 'Resumen y ELI5'], ['plazos', 'Plazos y cifras'], ['glosario', 'Glosario'], ['trucos', 'Mnemotecnias']].map(([k, l]) => `<button role="tab" class="${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}
    </div>
    <div id="tabBody"></div>`;
  const body = $('#tabBody', el);
  const draw = (k) => {
    $$('.tabs button', el).forEach((b) => b.classList.toggle('active', b.dataset.tab === k));
    if (k === 'temas') {
      body.innerHTML = m.topics.map((t, i) => { const s = topicStats(t.id); return `
        <a class="tile" style="margin:10px 0" href="#/t/${t.id}">
          <div class="row" style="justify-content:space-between"><h3>${i + 1}. ${esc(t.title)}</h3><span class="pill ${s.studied ? 'ok' : ''}">${s.studied ? '✓ Leído' : 'Sin leer'}</span></div>
          <p>${esc(t.range || '')} · ${plural(t.articles.length, 'artículo')} · ${t.flashcards.length} flashcards · ${t.questions.length} preguntas</p>
          ${bar(s.mastery)}
        </a>`; }).join('');
    } else if (k === 'resumen') {
      body.innerHTML = `<div class="card prose"><h3 style="margin-top:0">Resumen general</h3>${paras(m.overview)}</div>${eli5Box(m.eli5)}
        ${m.whyItMatters ? `<div class="why"><span class="label">🎯 Por qué importa para el concurso</span>${paras(m.whyItMatters)}</div>` : ''}`;
    } else if (k === 'plazos') {
      body.innerHTML = deadlineTable(m.deadlines || [], false);
    } else if (k === 'glosario') {
      body.innerHTML = (m.glossary || []).map((g) => `<div class="card"><b>${esc(g.term)}</b><div>${esc(g.def)}</div></div>`).join('') || '<p class="muted">Sin términos.</p>';
    } else {
      body.innerHTML = (m.mnemonics || []).map((g) => `<div class="card"><b>💡 ${esc(g.title)}</b><div class="prose">${paras(g.text)}</div></div>`).join('') || '<p class="muted">Sin reglas.</p>';
    }
  };
  $('.tabs', el).addEventListener('click', (e) => { const k = e.target.dataset.tab; if (k) { history.replaceState(null, '', `#/m/${mid}?tab=${k}`); draw(k); } });
  draw(tab);
});

route(/^\/t\/([^/]+)$/, (el, [tid]) => {
  const t = DB.topicById[tid];
  if (!t) { el.innerHTML = '<p>Tema no encontrado.</p>'; return; }
  const m = DB.modById[t._mid];
  const idx = m.topics.indexOf(t);
  const prev = m.topics[idx - 1], next = m.topics[idx + 1];
  const s = topicStats(tid);
  el.innerHTML = `
    <div class="crumbs"><a href="#/">Inicio</a> › <a href="#/m/${m.id}">${esc(modLabel(m.id))}</a> › Tema ${idx + 1}</div>
    <h1>${esc(t.title)}</h1>
    <p class="lead">${esc(t.range || '')} · ${plural(t.articles.length, 'artículo')} · Dominio ${s.mastery}%</p>
    <div class="card prose"><h3 style="margin-top:0">📌 Resumen</h3>${paras(t.summary)}</div>
    ${eli5Box(t.eli5)}
    ${t.keyPoints?.length ? `<div class="card"><h3 style="margin-top:0">🔑 Puntos clave</h3><ul class="keys">${t.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>` : ''}
    <h2>Artículos</h2>
    <div class="row" style="margin-bottom:6px"><button class="btn small" id="openAll">Abrir todos</button><button class="btn small" id="closeAll">Cerrar todos</button><label class="chk small"><input type="checkbox" id="showLegal" checked> Mostrar texto literal</label></div>
    <div id="arts">${t.articles.map((a) => articleHtml(a, m.id)).join('')}</div>
    <h2>Practicar este tema</h2>
    ${practiceButtons('t:' + tid)}
    <div class="card row" style="justify-content:space-between;margin-top:18px">
      <label class="chk"><input type="checkbox" id="studiedChk" ${s.studied ? 'checked' : ''}> Marcar tema como leído</label>
      <div class="row">${prev ? `<a class="btn small" href="#/t/${prev.id}">← Anterior</a>` : ''}${next ? `<a class="btn small primary" href="#/t/${next.id}">Siguiente →</a>` : `<a class="btn small" href="#/m/${m.id}">Volver al módulo</a>`}</div>
    </div>`;
  $('#openAll', el).onclick = () => $$('details.art', el).forEach((d) => (d.open = true));
  $('#closeAll', el).onclick = () => $$('details.art', el).forEach((d) => (d.open = false));
  $('#showLegal', el).onchange = (e) => $$('.legal-wrap', el).forEach((d) => (d.style.display = e.target.checked ? '' : 'none'));
  $('#studiedChk', el).onchange = (e) => { if (e.target.checked) state.studied[tid] = true; else delete state.studied[tid]; save(); buildNav(); };
  $$('details.art', el).forEach((d) => d.addEventListener('toggle', () => { if (d.open) { state.read[`${m.id}#${d.dataset.num}`] = 1; save(); } }));
});

function articleHtml(a, mid) {
  const cards = DB.cards.filter((c) => c.mid === mid && c.art === a.num).length;
  return `<details class="art" id="art-${esc(a.num)}" data-num="${esc(a.num)}">
    <summary><span class="num">Art. ${esc(a.num)}</span><span class="ttl">${esc(a.title || '')}</span>${state.read[`${mid}#${a.num}`] ? '<span class="pill ok">visto</span>' : ''}</summary>
    <div class="art-body">
      <div class="prose"><p><b>Qué dice:</b> ${esc(a.summary)}</p></div>
      ${eli5Box(a.eli5)}
      ${a.keyPoints?.length ? `<ul class="keys">${a.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
      ${a.trap ? `<div class="trap"><span class="label">⚠️ Ojo en el examen</span>${esc(a.trap)}</div>` : ''}
      <div class="legal-wrap"><div class="small muted" style="margin-top:10px">Texto literal</div><div class="legal">${esc(a.text)}</div></div>
      <div class="row small muted">${cards} flashcards de este artículo</div>
    </div></details>`;
}

function deadlineTable(rows, withMod, q) {
  if (!rows.length) return '<p class="muted">Sin resultados.</p>';
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Qué</th><th>Plazo / cifra</th><th>Art.</th>${withMod ? '<th>Norma</th>' : ''}</tr></thead><tbody>
    ${rows.map((d) => `<tr><td>${highlight(d.what, q)}</td><td><b>${highlight(d.value, q)}</b></td><td>${esc(d.art || '')}</td>${withMod ? `<td class="small">${esc(modLabel(d.mid))}</td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}

route(/^\/plazos$/, (el, _, params) => {
  el.innerHTML = `<h1>Tabla de plazos, cifras y mayorías</h1>
    <p class="lead">Todo lo numérico del temario en un solo lugar. Es lo que más se pregunta en pruebas de oposición.</p>
    <div class="row"><input class="inp" type="text" id="dq" placeholder="Filtrar (ej: 10 días, recurso, sumario)" style="flex:1;min-width:200px" value="${esc(params.get('q') || '')}">
    <select id="dm"><option value="">Todas las normas</option>${DB.mods.map((m) => `<option value="${m.id}">${esc(modLabel(m.id))}</option>`).join('')}</select>
    <a class="btn" href="#/quiz?scope=all&plazos=1&n=20">Quiz de plazos</a></div>
    <div id="dt" style="margin-top:12px"></div>`;
  const draw = () => {
    const q = $('#dq', el).value, mm = $('#dm', el).value;
    const rows = DB.deadlines.filter((d) => (!mm || d.mid === mm) && (!q || norm(d.what + ' ' + d.value + ' ' + d.art).includes(norm(q))));
    $('#dt', el).innerHTML = `<p class="muted small">${rows.length} filas</p>` + deadlineTable(rows, true, q);
  };
  $('#dq', el).oninput = draw; $('#dm', el).onchange = draw; draw();
});

route(/^\/glosario$/, (el) => {
  const items = DB.glossary.slice().sort((a, b) => a.term.localeCompare(b.term, 'es'));
  el.innerHTML = `<h1>Glosario</h1><p class="lead">${items.length} términos de todo el temario.</p>
    <input class="inp" type="text" id="gq" placeholder="Filtrar términos" style="width:100%"><div id="gl"></div>`;
  const draw = () => {
    const q = $('#gq', el).value;
    const rows = items.filter((g) => !q || norm(g.term + ' ' + g.def).includes(norm(q)));
    $('#gl', el).innerHTML = rows.map((g) => `<div class="card"><b>${highlight(g.term, q)}</b> <span class="pill">${esc(modLabel(g.mid))}</span><div>${highlight(g.def, q)}</div></div>`).join('') || '<p class="muted">Sin resultados.</p>';
  };
  $('#gq', el).oninput = draw; draw();
});

route(/^\/trucos$/, (el) => {
  el.innerHTML = `<h1>Reglas mnemotécnicas</h1><p class="lead">Atajos para memorizar lo difícil.</p>
    ${DB.mods.map((m) => (m.mnemonics?.length ? `<h2>${esc(modLabel(m.id))}</h2>${m.mnemonics.map((g) => `<div class="card"><b>💡 ${esc(g.title)}</b><div class="prose">${paras(g.text)}</div></div>`).join('')}` : '')).join('')}`;
});

route(/^\/buscar$/, (el, _, params) => {
  const q = params.get('q') || '';
  const nq = norm(q);
  const artNum = q.match(/^\s*(?:art(?:iculo|\.)?\s*)?(\d{1,4})\s*$/i);
  let arts = [];
  if (nq.length >= 2) {
    arts = DB.articles.filter((a) => (artNum && a.num === artNum[1]) || norm(`${a.title} ${a.text} ${a.summary}`).includes(nq));
  }
  const topics = nq.length >= 2 ? Object.values(DB.topicById).filter((t) => norm(t.title + ' ' + t.summary).includes(nq)) : [];
  const dls = nq.length >= 2 ? DB.deadlines.filter((d) => norm(d.what + ' ' + d.value).includes(nq)) : [];
  el.innerHTML = `<h1>Resultados para “${esc(q)}”</h1>
    <p class="lead">${plural(arts.length, 'artículo')} · ${plural(topics.length, 'tema')} · ${plural(dls.length, 'plazo')}</p>
    ${topics.length ? `<h2>Temas</h2>${topics.map((t) => `<a class="tile" style="margin:8px 0" href="#/t/${t.id}"><h3>${highlight(t.title, q)}</h3><p>${esc(modLabel(t._mid))} · ${esc(t.range || '')}</p></a>`).join('')}` : ''}
    ${arts.length ? `<h2>Artículos</h2>${arts.slice(0, 80).map((a) => { const snippet = snip(a.text, q); return `<a class="tile" style="margin:8px 0" href="#/t/${a.tid}?art=${encodeURIComponent(a.num)}"><h3>Art. ${esc(a.num)} – ${highlight(a.title || '', q)}</h3><p>${esc(modLabel(a.mid))}</p><p style="margin-top:6px">${snippet}</p></a>`; }).join('')}${arts.length > 80 ? '<p class="muted">Mostrando los primeros 80.</p>' : ''}` : ''}
    ${dls.length ? `<h2>Plazos</h2>${deadlineTable(dls, true, q)}` : ''}
    ${!arts.length && !topics.length && !dls.length ? '<p class="muted">No se encontró nada. Probá con otra palabra o un número de artículo (ej: “168”).</p>' : ''}`;
});
function snip(text, q) {
  const n = norm(text), i = n.indexOf(norm(q));
  if (i < 0) return esc(text.slice(0, 180)) + (text.length > 180 ? '…' : '');
  const s = Math.max(0, i - 80), e = Math.min(text.length, i + q.length + 120);
  return (s ? '…' : '') + highlight(text.slice(s, e), q) + (e < text.length ? '…' : '');
}

/* ---------- selector de alcance ---------- */
function scopeSelector(current) {
  const opts = [`<option value="all">Todo el temario</option>`];
  for (const s of SYLLABUS) opts.push(`<option value="m:${s.mods.join(',')}" ${current === 'm:' + s.mods.join(',') ? 'selected' : ''}>${esc(s.label.split(':')[0].replace(' – arts. 26-79', ' (TOCAF)'))}</option>`);
  for (const m of DB.mods) {
    opts.push(`<optgroup label="${esc(modLabel(m.id))}">`);
    if (m.part) opts.push(`<option value="m:${m.id}" ${current === 'm:' + m.id ? 'selected' : ''}>${esc(modLabel(m.id))} (todo)</option>`);
    for (const t of m.topics) opts.push(`<option value="t:${t.id}" ${current === 't:' + t.id ? 'selected' : ''}>${esc(t.title.slice(0, 90))}</option>`);
    opts.push('</optgroup>');
  }
  return `<select id="scopeSel" style="max-width:100%">${opts.join('')}</select>`;
}

/* ---------- flashcards (repetición espaciada) ---------- */
route(/^\/flash$/, (el, _, params) => {
  const scope = params.get('scope') || 'all';
  const mode = params.get('mode') || 'smart';
  const pool = scopeItems(scope, DB.cards);
  let deck;
  if (mode === 'all') deck = shuffle(pool);
  else if (mode === 'hard') deck = shuffle(pool.filter((c) => state.srs[c.key] && state.srs[c.key].b <= 1));
  else {
    const due = pool.filter((c) => state.srs[c.key] && cardDue(c.key)).sort((a, b) => state.srs[a.key].due - state.srs[b.key].due);
    const fresh = pool.filter((c) => !state.srs[c.key]);
    deck = [...due, ...fresh.slice(0, Math.max(20, 40 - due.length))];
  }
  let i = 0, flipped = false, done = 0;
  const counts = { again: 0, hard: 0, good: 0, easy: 0 };
  el.innerHTML = `<div class="crumbs"><a href="#/">Inicio</a> › Flashcards</div>
    <h1>Flashcards</h1>
    <div class="form-grid"><label>Alcance ${scopeSelector(scope)}</label>
      <label>Modo <select id="modeSel"><option value="smart" ${mode === 'smart' ? 'selected' : ''}>Inteligente (pendientes + nuevas)</option><option value="all" ${mode === 'all' ? 'selected' : ''}>Todas, mezcladas</option><option value="hard" ${mode === 'hard' ? 'selected' : ''}>Sólo las que me cuestan</option></select></label></div>
    <div id="fc"></div>
    <p class="small muted">Atajos: <span class="kbd">Espacio</span> girar · <span class="kbd">1</span> Otra vez · <span class="kbd">2</span> Difícil · <span class="kbd">3</span> Bien · <span class="kbd">4</span> Fácil</p>`;
  const reload = () => go(`#/flash?scope=${encodeURIComponent($('#scopeSel', el).value)}&mode=${$('#modeSel', el).value}`);
  $('#scopeSel', el).onchange = reload; $('#modeSel', el).onchange = reload;
  const box = $('#fc', el);
  const draw = () => {
    if (i >= deck.length) {
      box.innerHTML = `<div class="card" style="text-align:center"><div class="result-big">🎉</div><h2>${deck.length ? 'Sesión terminada' : 'No hay tarjetas para repasar ahora'}</h2>
        <p>${done ? `Repasaste ${plural(done, 'tarjeta')}: ${counts.again} otra vez · ${counts.hard} difícil · ${counts.good} bien · ${counts.easy} fácil.` : 'Probá el modo “Todas, mezcladas” o elegí otro alcance.'}</p>
        <div class="row" style="justify-content:center"><button class="btn primary" id="again">Otra ronda</button><a class="btn" href="#/quiz?scope=${encodeURIComponent(scope)}&n=10">Hacer preguntas</a></div></div>`;
      $('#again', box).onclick = () => render();
      return;
    }
    const c = deck[i]; flipped = false;
    const t = DB.topicById[c.tid];
    const b = cardBox(c.key);
    box.innerHTML = `<div class="qhead"><span>${i + 1} / ${deck.length}</span><span>${esc(modLabel(c.mid))} · Art. ${esc(c.art || '')}</span><span class="pill ${b < 0 ? 'pri' : b >= 2 ? 'ok' : 'warn'}">${b < 0 ? 'Nueva' : 'Caja ' + b}</span></div>
      <div class="flash-wrap"><div class="flash" id="card" tabindex="0" role="button" aria-label="Girar tarjeta">
        <div class="face front"><span class="meta">${esc(t.title.slice(0, 70))}</span><div>${esc(c.q)}</div><span class="hint">Tocá para ver la respuesta</span></div>
        <div class="face back"><span class="meta">Respuesta</span><div>${esc(c.a)}</div><span class="hint"><a href="#/t/${c.tid}?art=${encodeURIComponent(c.art || '')}" onclick="event.stopPropagation()">Ver artículo</a></span></div>
      </div></div>
      <div class="row" id="rate" style="justify-content:center;visibility:hidden">
        <button class="btn bad" data-r="again">Otra vez</button><button class="btn warn" data-r="hard">Difícil</button><button class="btn ok" data-r="good">Bien</button><button class="btn primary" data-r="easy">Fácil</button>
      </div>`;
    const card = $('#card', box);
    const flip = () => { flipped = !flipped; card.classList.toggle('flipped', flipped); $('#rate', box).style.visibility = 'visible'; };
    card.onclick = flip;
    $('#rate', box).onclick = (e) => { const r = e.target.dataset.r; if (r) rate(r); };
    box._flip = flip;
  };
  const rate = (r) => {
    const c = deck[i];
    const cur = state.srs[c.key] || { b: 0, due: 0 };
    let b = cur.b;
    if (r === 'again') { b = 0; deck.push(c); }
    else if (r === 'hard') b = Math.max(1, b);
    else if (r === 'good') b = Math.min(6, b + 1);
    else b = Math.min(6, b + 2);
    const due = r === 'again' ? Date.now() + 60000 : r === 'hard' ? Date.now() + DAY * 0.5 : Date.now() + INTERVALS[b] * DAY;
    state.srs[c.key] = { b, due };
    counts[r]++; done++; i++; save(); draw();
  };
  const key = (e) => {
    if (e.target.matches('input,select,textarea')) return;
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); box._flip && i < deck.length && box._flip(); }
    else if (flipped && ['1', '2', '3', '4'].includes(e.key)) rate(['again', 'hard', 'good', 'easy'][+e.key - 1]);
  };
  document.addEventListener('keydown', key);
  cleanup = () => document.removeEventListener('keydown', key);
  draw();
});

/* ---------- motor de preguntas ---------- */
function recordAnswer(q, ok) {
  const r = state.qs[q.key] || { c: 0, w: 0 };
  if (ok) r.c++; else r.w++;
  r.last = ok ? 1 : 0; r.t = Date.now();
  state.qs[q.key] = r; save();
}
function questionHtml(q, i, total, opts = {}) {
  const typeLbl = { mc: 'Opción múltiple', tf: 'Verdadero / Falso', case: 'Caso práctico' }[q.type] || 'Pregunta';
  return `<div class="card">
    <div class="qhead"><span>${opts.hideCounter ? '' : `Pregunta ${i + 1} de ${total}`}</span><span><span class="pill">${typeLbl}</span><span class="pill">${'★'.repeat(q.difficulty || 1)}</span></span></div>
    <div class="small muted">${esc(modLabel(q.mid))}${q.art ? ` · Art. ${esc(q.art)}` : ''}</div>
    <div class="qtext">${esc(q.q)}</div>
    <div class="q-opts">${q.options.map((o, k) => `<button class="opt" data-k="${k}"><span class="k">${q.type === 'tf' ? '' : String.fromCharCode(65 + k) + ')'}</span><span>${esc(o)}</span></button>`).join('')}</div>
    <div class="fb"></div></div>`;
}
function explainHtml(q, ok) {
  return `<div class="explain ${ok ? 'ok' : 'bad'}"><b>${ok ? '✅ ¡Correcto!' : `❌ Incorrecto. La respuesta es: ${esc(q.options[q.answer])}`}</b><div class="prose" style="margin-top:6px">${paras(q.explanation)}</div>
    ${artContext(q)}</div>`;
}

function artContext(q) {
  const a = DB.articles.find((x) => x.mid === q.mid && x.num === q.art);
  if (!a) return '';
  return `<details style="margin-top:8px"><summary class="small" style="cursor:pointer"><b>📖 Repasar el art. ${esc(a.num)}</b>${a.title ? ' – ' + esc(a.title) : ''}</summary>
    <p class="small" style="margin:8px 0 4px">${esc(a.summary)}</p><div class="legal small">${esc(a.text)}</div>
    <a class="small" href="#/t/${a.tid}?art=${encodeURIComponent(a.num)}">Ir al tema completo →</a></details>`;
}

route(/^\/quiz$/, (el, _, params) => {
  const scope = params.get('scope') || 'all';
  let n = params.has('n') ? +params.get('n') : 10;
  const type = params.get('type') || '';
  const diff = params.get('d') || '';
  const onlyNew = params.get('new') === '1';
  const plazos = params.get('plazos') === '1';
  let pool = scopeItems(scope, DB.questions);
  if (type) pool = pool.filter((q) => q.type === type);
  if (diff) pool = pool.filter((q) => String(q.difficulty || 1) === diff);
  if (onlyNew) pool = pool.filter((q) => !state.qs[q.key]);
  if (plazos) pool = pool.filter((q) => /\b\d+\s*(d[ií]as?|horas?|meses|años|a[nñ]os)\b|mayor[ií]a|tercios|quintos/i.test(q.q + ' ' + q.options.join(' ')));
  let list = shuffle(pool);
  if (n > 0) list = list.slice(0, n);
  el.innerHTML = `<div class="crumbs"><a href="#/">Inicio</a> › Preguntas</div><h1>Preguntas${plazos ? ' de plazos y cifras' : ''}</h1>
    <details class="card"><summary><b>Configurar</b> <span class="muted small">(${esc(scopeName(scope))} · ${list.length} preguntas)</span></summary>
    <div class="form-grid" style="margin-top:10px">
      <label>Alcance ${scopeSelector(scope)}</label>
      <label>Cantidad <select id="nSel">${[10, 20, 30, 50, 0].map((v) => `<option value="${v}" ${v === n ? 'selected' : ''}>${v || 'Todas'}</option>`).join('')}</select></label>
      <label>Tipo <select id="tSel"><option value="">Todos</option><option value="mc" ${type === 'mc' ? 'selected' : ''}>Opción múltiple</option><option value="tf" ${type === 'tf' ? 'selected' : ''}>Verdadero/Falso</option><option value="case" ${type === 'case' ? 'selected' : ''}>Casos prácticos</option></select></label>
      <label>Dificultad <select id="dSel"><option value="">Todas</option><option value="1" ${diff === '1' ? 'selected' : ''}>★ Fácil</option><option value="2" ${diff === '2' ? 'selected' : ''}>★★ Media</option><option value="3" ${diff === '3' ? 'selected' : ''}>★★★ Difícil</option></select></label>
    </div>
    <div class="row" style="margin-top:10px"><label class="chk"><input type="checkbox" id="newChk" ${onlyNew ? 'checked' : ''}> Sólo preguntas que nunca respondí</label><label class="chk"><input type="checkbox" id="plzChk" ${plazos ? 'checked' : ''}> Sólo plazos y cifras</label><button class="btn primary small" id="apply">Aplicar</button></div>
    </details>
    <div id="qz"></div>`;
  $('#apply', el).onclick = () => go(`#/quiz?scope=${encodeURIComponent($('#scopeSel', el).value)}&n=${$('#nSel', el).value}&type=${$('#tSel', el).value}&d=${$('#dSel', el).value}${$('#newChk', el).checked ? '&new=1' : ''}${$('#plzChk', el).checked ? '&plazos=1' : ''}`);
  runQuiz($('#qz', el), list, { scope, onRetry: () => render() });
});

function runQuiz(box, list, { scope, onRetry, reviewMode } = {}) {
  let i = 0, score = 0;
  const wrong = [];
  const draw = () => {
    if (!list.length) { box.innerHTML = `<div class="card"><p>No hay preguntas con esos filtros.</p></div>`; return; }
    if (i >= list.length) {
      const p = pct(score, list.length);
      box.innerHTML = `<div class="card" style="text-align:center"><div class="result-big">${p}%</div><p>${score} de ${list.length} correctas</p>
        <p class="muted">${p >= 80 ? 'Excelente, estás muy firme.' : p >= 60 ? 'Bien, repasá los errores y seguí.' : 'Hay que reforzar: volvé a leer los temas y repasá los errores.'}</p>
        <div class="row" style="justify-content:center"><button class="btn primary" id="retry">Nueva ronda</button>${wrong.length ? `<button class="btn warn" id="rw">Repetir las ${wrong.length} que erré</button>` : ''}</div></div>
        ${wrong.length ? `<h2>Para repasar</h2>${wrong.map((q) => `<div class="card"><div class="qtext">${esc(q.q)}</div><div>✅ ${esc(q.options[q.answer])}</div><div class="small muted">${esc(q.explanation)}</div><a class="small" href="#/t/${q.tid}?art=${encodeURIComponent(q.art || '')}">Ver artículo ${esc(q.art || '')}</a></div>`).join('')}` : ''}`;
      $('#retry', box).onclick = onRetry || (() => render());
      if (wrong.length) $('#rw', box).onclick = () => runQuiz(box, shuffle(wrong), { scope, onRetry, reviewMode });
      return;
    }
    const q = list[i];
    box.innerHTML = `<div class="bar" style="margin-bottom:10px"><i style="width:${pct(i, list.length)}%"></i></div>` + questionHtml(q, i, list.length);
    const fb = $('.fb', box);
    $$('.opt', box).forEach((b) => (b.onclick = () => {
      const k = +b.dataset.k, ok = k === q.answer;
      $$('.opt', box).forEach((x) => { x.disabled = true; const kk = +x.dataset.k; if (kk === q.answer) x.classList.add('correct'); else if (kk === k) x.classList.add('wrong'); });
      recordAnswer(q, ok); if (ok) score++; else wrong.push(q);
      fb.innerHTML = explainHtml(q, ok) + `<div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" id="nx">${i + 1 < list.length ? 'Siguiente →' : 'Ver resultado'}</button></div>`;
      $('#nx', box).onclick = () => { i++; draw(); window.scrollTo({ top: box.offsetTop - 70, behavior: 'smooth' }); };
      $('#nx', box).focus({ preventScroll: true });
    }));
  };
  draw();
}

route(/^\/errores$/, (el) => {
  const list = DB.questions.filter((q) => state.qs[q.key]?.last === 0);
  const byMod = {};
  list.forEach((q) => (byMod[q.mid] = (byMod[q.mid] || 0) + 1));
  el.innerHTML = `<div class="crumbs"><a href="#/">Inicio</a> › Mis errores</div><h1>Mis errores</h1>
    <p class="lead">Preguntas cuya última respuesta fue incorrecta. Al acertarlas salen de esta lista.</p>
    ${list.length ? `<div class="chipbar">${Object.entries(byMod).map(([m, c]) => `<span class="pill bad">${esc(modLabel(m))}: ${c}</span>`).join('')}</div>` : ''}
    <div id="qz"></div>`;
  if (!list.length) { $('#qz', el).innerHTML = '<div class="card">No tenés errores pendientes. 👏 Hacé más preguntas para seguir midiendo.</div>'; return; }
  runQuiz($('#qz', el), shuffle(list), { onRetry: () => render(), reviewMode: true });
});

/* ---------- simulacro ---------- */
route(/^\/examen$/, (el, _, params) => {
  if (!params.get('go')) {
    const last = state.exams.slice(-5).reverse();
    el.innerHTML = `<div class="crumbs"><a href="#/">Inicio</a> › Simulacro</div><h1>Simulacro de examen</h1>
      <p class="lead">Preguntas al azar de todo el temario, ponderadas por el peso de cada norma, con cronómetro y corrección al final (como en la prueba real: no ves si acertaste hasta entregar).</p>
      <div class="card"><div class="form-grid">
        <label>Cantidad de preguntas <select id="en">${[25, 50, 75, 100].map((v) => `<option ${v === 50 ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Tiempo (minutos) <select id="et">${[30, 45, 60, 90, 120].map((v) => `<option ${v === 60 ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Dificultad <select id="ed"><option value="">Mixta</option><option value="23">Media y difícil</option><option value="3">Sólo difíciles</option></select></label>
      </div><div class="row" style="margin-top:12px"><button class="btn primary" id="start">Empezar simulacro</button></div></div>
      ${last.length ? `<h2>Últimos simulacros</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Resultado</th><th>Nota /50</th><th>Tiempo</th></tr></thead><tbody>${last.map((x) => `<tr><td>${new Date(x.date).toLocaleString('es-UY')}</td><td>${x.score}/${x.total} (${pct(x.score, x.total)}%)</td><td><b>${(50 * x.score / x.total).toFixed(1)}</b></td><td>${Math.round(x.dur / 60)} min</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    $('#start', el).onclick = () => go(`#/examen?go=1&n=${$('#en', el).value}&t=${$('#et', el).value}&d=${$('#ed', el).value}`);
    return;
  }
  const n = +params.get('n') || 50, mins = +params.get('t') || 60, d = params.get('d') || '';
  let pool = DB.questions.filter((q) => !d || d.includes(String(q.difficulty || 1)));
  // ponderación: proporcional a la cantidad de artículos de cada bloque de la bibliografía, con un mínimo por bloque
  const groups = SYLLABUS.map((s) => ({ s, qs: shuffle(pool.filter((q) => s.mods.includes(q.mid))), w: DB.articles.filter((a) => s.mods.includes(a.mid)).length }));
  const W = groups.reduce((a, g) => a + g.w, 0);
  let list = [];
  groups.forEach((g) => list.push(...g.qs.slice(0, Math.max(2, Math.round((n * g.w) / W)))));
  list = shuffle(list).slice(0, n);
  const answers = new Array(list.length).fill(null);
  const t0 = Date.now(), end = t0 + mins * 60000;
  let cur = 0, finished = false;
  el.innerHTML = `<div class="row" style="justify-content:space-between;position:sticky;top:55px;background:var(--bg);padding:8px 0;z-index:5">
      <b>Simulacro · ${list.length} preguntas</b><span class="timer" id="tm"></span><button class="btn small warn" id="finish">Entregar</button></div>
    <div id="nav" class="chipbar"></div><div id="ex"></div>`;
  const tm = $('#tm', el);
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    tm.textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
    if (left <= 0 && !finished) finish();
  };
  const iv = setInterval(tick, 500); tick();
  cleanup = () => clearInterval(iv);
  const drawNav = () => { $('#nav', el).innerHTML = list.map((_, k) => `<button class="chip ${k === cur ? 'active' : ''}" data-k="${k}" title="Pregunta ${k + 1}">${k + 1}${answers[k] !== null ? '·' : ''}</button>`).join(''); };
  $('#nav', el).onclick = (e) => { const k = e.target.dataset.k; if (k !== undefined) { cur = +k; draw(); } };
  const draw = () => {
    drawNav();
    const q = list[cur];
    $('#ex', el).innerHTML = questionHtml(q, cur, list.length) + `<div class="row" style="justify-content:space-between"><button class="btn" id="pv" ${cur ? '' : 'disabled'}>← Anterior</button><button class="btn primary" id="nx">${cur + 1 < list.length ? 'Siguiente →' : 'Revisar y entregar'}</button></div>`;
    $$('#ex .opt', el).forEach((b) => { if (+b.dataset.k === answers[cur]) b.style.borderColor = 'var(--primary)', b.style.background = 'var(--primary-soft)'; b.onclick = () => { answers[cur] = +b.dataset.k; draw(); }; });
    $('#pv', el).onclick = () => { cur--; draw(); };
    $('#nx', el).onclick = () => { if (cur + 1 < list.length) { cur++; draw(); } else finish(); };
  };
  const finish = () => {
    if (finished) return;
    const blank = answers.filter((a) => a === null).length;
    if (blank && Date.now() < end && !confirmInline(blank)) return;
    finished = true; clearInterval(iv);
    let score = 0;
    list.forEach((q, k) => { if (answers[k] !== null) { const ok = answers[k] === q.answer; recordAnswer(q, ok); if (ok) score++; } });
    const dur = Math.round((Date.now() - t0) / 1000);
    state.exams.push({ date: Date.now(), score, total: list.length, dur }); save();
    const byMod = {};
    list.forEach((q, k) => { const g = SYLLABUS.find((s) => s.mods.includes(q.mid)).label.split(':')[0]; byMod[g] = byMod[g] || { ok: 0, n: 0 }; byMod[g].n++; if (answers[k] === q.answer) byMod[g].ok++; });
    el.innerHTML = `<h1>Resultado del simulacro</h1>
      <div class="card" style="text-align:center"><div class="result-big">${(50 * score / list.length).toFixed(1)} / 50</div><p>${score} de ${list.length} correctas (${pct(score, list.length)}%) · ${Math.round(dur / 60)} min</p></div>
      ${pct(score, list.length) >= 70 ? `<div class="support-wink">🎉 ¡Tremendo simulacro! Si la app te está sirviendo, el desarrollador acepta felicitaciones… y también <a href="#/apoyar">transferencias</a>. 😇</div>` : ''}
      <h2>Por norma</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Norma</th><th>Aciertos</th><th>%</th></tr></thead><tbody>${Object.entries(byMod).map(([g, v]) => `<tr><td>${esc(g)}</td><td>${v.ok}/${v.n}</td><td>${pct(v.ok, v.n)}%</td></tr>`).join('')}</tbody></table></div>
      <h2>Corrección</h2>
      ${list.map((q, k) => { const ok = answers[k] === q.answer; return `<div class="card"><div class="qhead"><span>${k + 1}. ${esc(modLabel(q.mid))} · Art. ${esc(q.art || '')}</span><span class="pill ${ok ? 'ok' : 'bad'}">${ok ? 'Correcta' : answers[k] === null ? 'Sin responder' : 'Incorrecta'}</span></div>
        <div class="qtext">${esc(q.q)}</div>${answers[k] !== null && !ok ? `<div>Tu respuesta: ${esc(q.options[answers[k]])}</div>` : ''}<div>✅ ${esc(q.options[q.answer])}</div><div class="small muted" style="margin-top:6px">${esc(q.explanation)}</div></div>`; }).join('')}
      <div class="row"><a class="btn primary" href="#/examen">Otro simulacro</a><a class="btn" href="#/errores">Repasar errores</a></div>`;
    window.scrollTo(0, 0);
  };
  let confirmArmed = 0;
  const confirmInline = (blank) => {
    if (Date.now() - confirmArmed < 5000) return true;
    confirmArmed = Date.now();
    const b = $('#finish', el); b.textContent = `Hay ${blank} sin responder. ¿Entregar igual? (tocá de nuevo)`;
    setTimeout(() => { if (!finished) b.textContent = 'Entregar'; }, 5000);
    return false;
  };
  $('#finish', el).onclick = finish;
  draw();
});

/* ---------- progreso ---------- */
route(/^\/progreso$/, (el) => {
  const g = globalStats();
  el.innerHTML = `<h1>Mi progreso</h1>
    <div class="stats">
      <div class="stat"><b>${g.mastery}%</b><span>Dominio global</span>${bar(g.mastery)}</div>
      <div class="stat"><b>${g.answered}</b><span>Preguntas respondidas (distintas)</span></div>
      <div class="stat"><b>${g.due}</b><span>Flashcards pendientes hoy</span></div>
      <div class="stat"><b>${g.errors}</b><span>Errores a repasar</span></div>
    </div>
    <h2>Por módulo y tema</h2>
    ${DB.mods.map((m) => { const s = modStats(m.id); return `<details class="card"><summary><b>${esc(modLabel(m.id))}</b> — dominio ${s.mastery}% · ${s.studied}/${s.topics} temas leídos</summary>
      <div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Tema</th><th>Leído</th><th>Flashcards</th><th>Preguntas</th><th>Dominio</th></tr></thead><tbody>
      ${m.topics.map((t) => { const x = topicStats(t.id); return `<tr><td><a href="#/t/${t.id}">${esc(t.title)}</a></td><td>${x.studied ? '✓' : ''}</td><td>${x.learned}/${x.cards}</td><td>${x.correct}/${x.total}</td><td><b>${x.mastery}%</b></td></tr>`; }).join('')}
      </tbody></table></div></details>`; }).join('')}
    <h2>Respaldo</h2>
    <div class="card"><p class="small muted">El progreso se guarda en este navegador. Para pasarlo a otro dispositivo, exportalo y después importalo allá.</p>
      <div class="row"><button class="btn" id="exp">⬇️ Exportar progreso</button><label class="btn">⬆️ Importar<input type="file" id="imp" accept="application/json" hidden></label><button class="btn bad" id="rst">Borrar todo el progreso</button></div><p id="msg" class="small"></p></div>`;
  $('#exp', el).onclick = () => {
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `progreso-mtop-0048-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#imp', el).onchange = async (e) => {
    try {
      const f = e.target.files[0]; const data = JSON.parse(await f.text());
      if (typeof data !== 'object' || !data || !('srs' in data) || !('qs' in data)) throw new Error('formato');
      for (const k of ['srs', 'qs', 'studied', 'read']) if (data[k] && typeof data[k] === 'object') state[k] = data[k];
      if (Array.isArray(data.exams)) state.exams = data.exams;
      save(); $('#msg', el).textContent = 'Progreso importado.'; setTimeout(render, 600);
    } catch { $('#msg', el).textContent = 'No se pudo importar: el archivo no es un respaldo válido.'; }
  };
  let armed = false;
  $('#rst', el).onclick = (e) => {
    if (!armed) { armed = true; e.target.textContent = '¿Seguro? Tocá de nuevo para borrar'; setTimeout(() => { armed = false; e.target.textContent = 'Borrar todo el progreso'; }, 4000); return; }
    Object.assign(state, { srs: {}, qs: {}, studied: {}, read: {}, exams: [] }); save(); setTimeout(render, 300);
  };
});

route(/^\/acerca$/, (el) => {
  el.innerHTML = `<h1>Sobre el llamado</h1>
  <div class="card prose">
    <p><b>Llamado a Concurso N° 0048/2026</b> – Ministerio de Transporte y Obras Públicas. Provisión de <b>27 plazas</b> de Administrativo V (Escalafón C – Grado 01), ocupación <b>Gestor/a Administrativo</b>, con destino a las Unidades Ejecutoras 003 (Dirección Nacional de Vialidad), 004 (Dirección Nacional de Hidrografía) y 007 (Dirección Nacional de Transporte), en modalidad de Provisoriato. Una plaza reservada para la cuota “Personas trans” (art. 12, Ley 19.684).</p>
    <p>Según el Acta N° 1 (16/09/2026): la <b>prueba de oposición</b> se realiza <b>del 26 al 30 de octubre</b>; lugar y horario se comunican por agenda en el Portal de Uruguay Concursa. Participan 500 postulaciones, según el orden de prelación del ordenamiento aleatorio.</p>
  </div>
  <h2>Tabla de valoración</h2>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Etapa</th><th>Factor / subfactor</th><th>Máximo</th></tr></thead><tbody>
    <tr><td>Prueba de oposición</td><td>Prueba de oposición</td><td><b>50</b></td></tr>
    <tr><td rowspan="3">Méritos y antecedentes (máx. 20)</td><td>Formación: cursos de herramientas ofimáticas (procesador de texto, planillas electrónicas, correo, Excel, OpenOffice, etc.) debidamente acreditados</td><td>3</td></tr>
    <tr><td>Formación: cursos debidamente acreditados afines a las principales actividades</td><td>7</td></tr>
    <tr><td>Experiencia: igual o superior a 6 meses en ámbito público y/o privado, documentada con detalle de tareas, relacionada al propósito del cargo</td><td>10</td></tr>
    <tr><td>Evaluación psicolaboral</td><td>Evaluación psicolaboral</td><td>15</td></tr>
    <tr><td>Entrevista personal</td><td>Perfil con relación al cargo o función</td><td>15</td></tr>
    <tr><td colspan="2"><b>Total</b></td><td><b>100</b></td></tr>
  </tbody></table></div>
  <h2>Bibliografía para la prueba</h2>
  <ul class="keys">${SYLLABUS.map((s) => `<li>${esc(s.label)}</li>`).join('')}</ul>
  <h2>Fuentes y avisos</h2>
  <div class="card prose small">
    <p>Los textos literales provienen de <a href="https://www.impo.com.uy" target="_blank" rel="noopener">IMPO</a> (Constitución, Decretos 500/991 y 222/014, TOCAF) y del <a href="https://www.gub.uy/oficina-nacional-servicio-civil/comunicacion/noticias/texto-ordenado-normas-sobre-funcionarios-publicos" target="_blank" rel="noopener">TOFUP 2024 de la ONSC</a>.</p>
    <p><b>TOCAF:</b> la base TOCAF de IMPO no incorpora todas las reformas legales posteriores a 2012. En los artículos donde la ley de origen tiene redacción más nueva (p. ej. arts. 33, 38, 52), se usó el texto legal vigente y se indica en el resumen del artículo. Si el tribunal toma el texto “histórico” del TOCAF, pueden diferir los montos. Revisá esos artículos con atención.</p>
    <p>Resúmenes, ELI5, flashcards y preguntas son material de estudio elaborado a partir de esos textos; ante cualquier diferencia, prevalece la norma oficial.</p>
  </div>`;
});

/* ---------- apoyar el proyecto ---------- */
function supportCard() {
  return `<div class="support-card">
    <div class="support-emoji" aria-hidden="true">☕</div>
    <div><b>¿Te está sirviendo la app?</b>
    <p>Un “gracias” siempre se agradece… pero el almacén de la esquina todavía no lo acepta como medio de pago. 😅 Si querés apoyar, todo es bienvenido.</p>
    <a class="btn small primary" href="#/apoyar">Apoyar el proyecto</a></div></div>`;
}
route(/^\/apoyar$/, (el) => {
  el.innerHTML = `<div class="crumbs"><a href="#/">Inicio</a> › Apoyar el proyecto</div>
    <h1>☕ Apoyar el proyecto</h1>
    <p class="lead">La app es y va a seguir siendo gratis. Esto es totalmente opcional (en serio… aunque no tanto 😏).</p>
    <div class="card prose">
      <p>Detrás de estas 1.698 flashcards y 1.617 preguntas hay muchas horas de leer decretos que nadie lee por gusto. Si la app te ayudó a entender el TOCAF sin llorar, a acordarte de que el sumario tiene 60 días o a sacar un buen simulacro, quizás te quede la duda: <i>“¿cómo le agradezco a esta persona?”</i></p>
      <p>Y sí, a veces solo las gracias no alcanzan. Las gracias no pagan el mate, ni la yerba, ni el café de las 2 de la mañana repasando el art. 168. <b>Si querés apoyar, todo es bienvenido</b>: desde lo que te sobre del vuelto hasta tu primer sueldo de Gestor Administrativo (es broma… salvo que quieras 😇).</p>
    </div>
    <div class="card">
      <h3 style="margin-top:0">Datos para transferir</h3>
      <p class="muted small" style="margin-top:0">${esc(SUPPORT.bank)} · Titular: <b>${esc(SUPPORT.holder)}</b></p>
      ${SUPPORT.accounts.map((a, i) => `<div class="acct"><div><div class="small muted">${esc(a.label)}</div><div class="acct-num">${esc(a.value)}</div></div>
        <button class="btn small" data-copy="${i}">📋 Copiar</button></div>`).join('')}
      <p class="small muted" id="copyMsg" aria-live="polite"></p>
    </div>
    <div class="card prose small muted"><p>¿No podés o no querés? Cero drama: compartir la app con quien también se esté preparando para el concurso ya es una tremenda ayuda. Y si quedás en una de las 27 plazas, avisá, que el festejo también cuenta. 🎉</p></div>`;
  el.addEventListener('click', async (e) => {
    const i = e.target.closest('[data-copy]')?.dataset.copy;
    if (i === undefined) return;
    const v = SUPPORT.accounts[+i].value;
    let ok = false;
    try { await navigator.clipboard.writeText(v); ok = true; } catch { /* sin permiso de portapapeles */ }
    $('#copyMsg', el).textContent = ok ? `Copiado: ${v}. ¡Gracias de antemano! 🙌` : `No pude copiar automáticamente; seleccioná el número a mano: ${v}`;
  });
});

/* ---------- navegación lateral ---------- */
function buildNav() {
  $('#navModules').innerHTML = DB.mods.map((m) => { const s = modStats(m.id); return `<a href="#/m/${m.id}" data-mod="${m.id}">${esc(NAV_NAMES[m.id] || m.shortTitle)}<span class="nav-progress">${s.mastery}%</span></a>`; }).join('');
  markNav(parseHash().path);
}

/* ---------- tema claro/oscuro ---------- */
function applyTheme() { if (state.theme) document.documentElement.dataset.theme = state.theme; else delete document.documentElement.dataset.theme; }
$('#themeBtn').onclick = () => {
  const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  state.theme = dark ? 'light' : 'dark'; save(); applyTheme();
};
applyTheme();
$('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
$('#scrim').onclick = () => document.body.classList.remove('nav-open');
$('#searchForm').onsubmit = (e) => { e.preventDefault(); const q = $('#searchInput').value.trim(); if (q) go(`#/buscar?q=${encodeURIComponent(q)}`); };

/* ---------- arranque ---------- */
(async () => {
  try {
    await loadData();
  } catch (e) {
    $('#main').innerHTML = `<div class="card"><h2>No se pudo cargar el contenido</h2><p>Si abriste el archivo directamente desde tu computadora, usá la versión publicada (GitHub Pages) o un servidor local.</p><p class="muted small">${esc(e.message)}</p></div>`;
    return;
  }
  buildNav();
  window.addEventListener('hashchange', () => { render(); buildNav(); });
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
