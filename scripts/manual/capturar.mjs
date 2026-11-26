// Tira as fotos do manual (scripts/manual/out/fotos) a partir da demo, sem salvar nada.
//
// Uso (Chrome aberto com --remote-debugging-port=9335):
//   MANUAL_GESTOR_USER=... MANUAL_GESTOR_PASS=... \
//   MANUAL_PLANTONISTA_USER=... MANUAL_PLANTONISTA_PASS=... \
//   node scripts/manual/capturar.mjs [ids separados por vírgula | todos] [base]
// Senhas só por variável de ambiente; nunca ficam em arquivo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIND_JS, buildNameMap, openIsolatedTab, scrubJs, sleep } from './lib.mjs';
import { login, rest } from '../tutoriais/lib.mjs';
import { SHOTS } from './fotos.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out', 'fotos');
fs.mkdirSync(OUT, { recursive: true });
const which = process.argv[2] || 'todos';
const base = process.argv[3] || 'https://scalemedic-app.vercel.app';
const shots = which === 'todos' ? SHOTS : SHOTS.filter(s => which.split(',').includes(s.id));
const VIEWS = {
  pc: { width: 1366, height: 768, deviceScaleFactor: 1.5, mobile: false },
  cel: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
};
const metaFile = path.join(OUT, 'fotos.json');
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};

async function mouseClick(tab, target) {
  await tab.ev(`window.__find(${JSON.stringify(target)})?.scrollIntoView({ block: 'center' })`); await sleep(400);
  const r = await tab.ev(`(() => { const r = window.__rect(${JSON.stringify(target)}, 0); return r && [r.x + r.w / 2, r.y + r.h / 2]; })()`);
  if (!r) throw new Error('não achei para clicar: ' + JSON.stringify(target));
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await tab.send('Input.dispatchMouseEvent', { type, x: r[0], y: r[1], button: 'left', clickCount: 1 });
  await sleep(900);
}

const STEP = {
  click: (tab, target) => mouseClick(tab, target),
  wait: (tab, ms) => sleep(ms),
  async clickIn(tab, container, text) {
    const ok = await tab.ev(`(() => { const c = window.__find(${JSON.stringify(container)}); const b = c && [...c.querySelectorAll('button')].find(x => x.innerText.trim() === ${JSON.stringify(text)}); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; })()`);
    if (!ok) throw new Error('clickIn falhou: ' + text);
    await sleep(900);
  },
  async selectValue(tab, selector, value) {
    await tab.ev(`(() => { const s = document.querySelector(${JSON.stringify(selector)}); if (!s) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    await sleep(1500);
  },
  async scrollTo(tab, target) {
    await tab.ev(`(() => { const el = window.__find(${JSON.stringify(target)}); el?.scrollIntoView({ block: 'start' }); const m = document.querySelector('main'); if (m) m.scrollTop -= 90; return !!el; })()`);
    await sleep(900);
  },
  async scrollDialog(tab, text) {
    await tab.ev(`(() => { const el = [...document.querySelectorAll('[role=dialog] *')].filter(e => (e.innerText || '').trim() === ${JSON.stringify(text)}).pop(); el?.scrollIntoView({ block: 'center' }); return !!el; })()`);
    await sleep(700);
  },
  async fillProfessional(tab) {
    await tab.ev(`(() => {
      const set = (el, v) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
      const inputs = [...document.querySelectorAll('[role=dialog] input')].filter(i => !['checkbox', 'date', 'file', 'hidden'].includes(i.type));
      if (inputs[0]) set(inputs[0], 'Ana Beatriz Rocha');
      if (inputs[1]) set(inputs[1], 'Clínica Médica');
      const date = document.querySelector('[role=dialog] input[type=date]');
      if (date) set(date, '1990-04-12');
      return inputs.length;
    })()`);
    await sleep(600);
  },
  async uncheckTemplate(tab) {
    // garante que "Guardar/Atualizar como turnos padrão" fique desmarcado: a foto não pode gravar nada
    await tab.ev(`(() => { const box = [...document.querySelectorAll('[role=dialog] input[type=checkbox]')].find(c => c.closest('label')?.innerText.includes('turnos padrão')); if (box && box.checked) box.click(); return box ? box.checked : null; })()`);
    await sleep(400);
  }
};

const sessions = {};
async function sessionFor(as) {
  if (sessions[as]) return sessions[as];
  const tab = await openIsolatedTab();
  if (as !== 'anon') {
    const user = process.env[`MANUAL_${as.toUpperCase()}_USER`];
    const pass = process.env[`MANUAL_${as.toUpperCase()}_PASS`];
    await tab.send('Emulation.setDeviceMetricsOverride', VIEWS.pc);
    console.log('entrando como', as, '→', await login(tab, base, user, pass));
  } else {
    await tab.send('Page.navigate', { url: base + '/login' }); await sleep(2000);
    await tab.ev(`localStorage.setItem('hospital-intelligence-theme', 'light'); 1`);
  }
  sessions[as] = tab;
  return tab;
}

// Nomes reais da demo -> fictícios (lidos com a sessão do gestor).
const gestor = await sessionFor('gestor');
const readJson = pathAndQuery => gestor.ev(`(async () => {
  const key = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k));
  const sess = JSON.parse(localStorage.getItem(key));
  const url = 'https://' + key.slice(3, key.indexOf('-auth-token')) + '.supabase.co/rest/v1/' + ${JSON.stringify(pathAndQuery)};
  const res = await fetch(url, { headers: { apikey: 'sb_publishable_aJYPYrAxzbYEU23ckNDpyg_H5nbZoX_', Authorization: 'Bearer ' + sess.access_token } });
  return res.ok ? res.json() : [];
})()`);
const profs = await readJson('professionals?select=name');
const users = await readJson('users?select=full_name');
const nameMap = buildNameMap([...profs.map(p => p.name), ...users.map(u => u.full_name)]);
console.log('nomes trocados:', nameMap.length);

for (const shot of shots) {
  const tab = await sessionFor(shot.as);
  const view = { ...VIEWS[shot.view], ...(shot.altura ? { height: shot.altura } : {}) };
  await tab.send('Emulation.setDeviceMetricsOverride', view);
  await tab.send('Emulation.setTouchEmulationEnabled', { enabled: view.mobile });
  await tab.send('Page.navigate', { url: base + shot.path }); await sleep(6500);
  await tab.ev(FIND_JS);
  // a ajuda que abre sozinha na 1ª visita fecha antes da foto
  if (await tab.ev(`!!document.querySelector('[role=dialog]')`)) { await tab.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await sleep(600); }
  try {
    for (const [name, ...args] of shot.steps || []) await STEP[name](tab, ...args);
  } catch (err) {
    console.log('  !', shot.id, err.message);
  }
  await sleep(700);
  await tab.ev(scrubJs(nameMap));
  await sleep(300);
  // recorte opcional: a união dos alvos + margem [cima, direita, baixo, esquerda]
  let clip = null;
  if (shot.clip) {
    const rects = [];
    for (const target of shot.clip.alvos) { const r = await tab.ev(`window.__rect(${JSON.stringify(target)}, 0)`); if (r) rects.push(r); }
    if (rects.length) {
      const [pt, pr, pb, pl] = shot.clip.margem || [24, 24, 24, 24];
      const x = Math.max(0, Math.min(...rects.map(r => r.x)) - pl), y = Math.max(0, Math.min(...rects.map(r => r.y)) - pt);
      const x2 = Math.min(view.width, Math.max(...rects.map(r => r.x + r.w)) + pr), y2 = Math.min(view.height, Math.max(...rects.map(r => r.y + r.h)) + pb);
      clip = { x, y, width: x2 - x, height: y2 - y };
    }
  }
  const marks = [];
  for (const target of shot.marks || []) {
    const r = await tab.ev(`window.__rect(${JSON.stringify(target)})`);
    marks.push(r && clip ? { ...r, x: r.x - clip.x, y: r.y - clip.y } : r);
  }
  const shotData = await tab.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  fs.writeFileSync(path.join(OUT, `${shot.id}.jpg`), Buffer.from(shotData.result.data, 'base64'));
  meta[shot.id] = { width: clip ? clip.width : view.width, height: clip ? clip.height : view.height, view: shot.view, marks };
  const missing = marks.map((m, i) => (m ? null : i + 1)).filter(Boolean);
  console.log(shot.id, missing.length ? `(pontos sem alvo: ${missing.join(', ')})` : 'ok', tab.errors.length ? tab.errors.splice(0) : '');
}
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));

// Conferência: nada pode ter sido gravado (só a UTI tem turnos padrão na demo).
const check = await rest(gestor, 'GET', 'companies?id=eq.cmp_principal&select=data->sector_shift_templates');
console.log('turnos padrão na demo:', String(check).match(/"sec_[a-z_]+"/g)?.join(', '));
for (const tab of Object.values(sessions)) await tab.dispose();
