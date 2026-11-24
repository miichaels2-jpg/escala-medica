// Gravador dos vídeos da tela "Como usar" (sem voz): controla um Chrome aberto com
// --remote-debugging-port, mostra cursor e legendas na página e grava os quadros
// com Page.startScreencast. Depois, encode.mjs monta o WebM.
import fs from 'node:fs';
import path from 'node:path';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function connect({ port = Number(process.env.CDP_PORT || 9335) } = {}) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method) listeners.forEach(fn => fn(m));
  });
  const send = (method, params = {}) => new Promise(r => { const i = ++seq; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erro no script da página');
    return r.result?.result?.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  return { ws, send, ev, on: fn => listeners.add(fn), close: () => ws.close() };
}

const OVERLAY = `(() => {
  if (window.__tut) return 1;
  const css = document.createElement('style');
  css.textContent = \`
    #tut-cursor { position: fixed; z-index: 2147483647; width: 22px; height: 22px; margin: -3px 0 0 -3px; pointer-events: none; transition: left .9s cubic-bezier(.4,0,.2,1), top .9s cubic-bezier(.4,0,.2,1); }
    #tut-cursor svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    #tut-ring { position: fixed; z-index: 2147483646; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%; border: 3px solid #0284c7; opacity: 0; pointer-events: none; }
    #tut-ring.on { animation: tutring .6s ease-out; }
    @keyframes tutring { from { opacity: .9; transform: scale(.4); } to { opacity: 0; transform: scale(1.6); } }
    #tut-cap { position: fixed; z-index: 2147483645; left: 50%; bottom: var(--tut-cap-bottom, 28px); transform: translateX(-50%); width: max-content; max-width: min(860px, calc(100vw - 32px)); padding: 14px 22px; border-radius: 14px; background: rgba(15,23,42,.93); color: #fff; font: 600 var(--tut-cap-size, 20px)/1.35 "Segoe UI", Roboto, Arial, sans-serif; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,.25); transition: opacity .35s; opacity: 0; pointer-events: none; }
    #tut-cap small { display: block; margin-top: 4px; font-weight: 400; font-size: .76em; color: #cbd5e1; }
    #tut-step { position: fixed; z-index: 2147483645; top: var(--tut-step-top, 96px); right: var(--tut-step-right, 40px); padding: 6px 12px; border-radius: 999px; background: #0369a1; color: #fff; font: 600 13px "Segoe UI", Arial, sans-serif; opacity: 0; transition: opacity .35s; pointer-events: none; }
    #tut-dialog { position: fixed; inset: 0; z-index: 2147483644; display: none; align-items: center; justify-content: center; background: rgba(15,23,42,.35); }
    #tut-dialog .box { width: min(420px, calc(100vw - 40px)); background: #fff; color: #0f172a; border-radius: 14px; padding: 20px; box-shadow: 0 20px 50px rgba(0,0,0,.3); font: 15px/1.45 "Segoe UI", Roboto, Arial, sans-serif; white-space: pre-line; }
    #tut-dialog .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    #tut-dialog button { min-width: 84px; height: 36px; border-radius: 9px; border: 1px solid #cbd5e1; background: #fff; font: 600 14px "Segoe UI", Arial, sans-serif; }
    #tut-dialog button.ok { background: #0369a1; border-color: #0369a1; color: #fff; }
  \`;
  document.head.appendChild(css);
  const c = document.createElement('div'); c.id = 'tut-cursor';
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#0f172a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const pos = JSON.parse(sessionStorage.getItem('tut-pos') || 'null') || [innerWidth / 2, innerHeight * 0.55];
  c.style.left = pos[0] + 'px'; c.style.top = pos[1] + 'px';
  const ring = document.createElement('div'); ring.id = 'tut-ring';
  const cap = document.createElement('div'); cap.id = 'tut-cap';
  const step = document.createElement('div'); step.id = 'tut-step';
  const dlg = document.createElement('div'); dlg.id = 'tut-dialog'; dlg.innerHTML = '<div class="box"><div class="msg"></div><div class="row"></div></div>';
  document.body.append(c, ring, cap, step, dlg);
  // Confirmações e avisos do navegador não aparecem na gravação: viram uma janela na página, com o mesmo texto.
  window.__tutDialogs = [];
  window.confirm = m => { window.__tutDialogs.push({ type: 'confirm', m: String(m) }); return true; };
  window.alert = m => { window.__tutDialogs.push({ type: 'alert', m: String(m) }); };
  window.__tut = {
    to(el) { const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; c.style.left = x + 'px'; c.style.top = y + 'px'; sessionStorage.setItem('tut-pos', JSON.stringify([x, y])); return [x, y]; },
    ring(x, y) { ring.style.left = x + 'px'; ring.style.top = y + 'px'; ring.classList.remove('on'); void ring.offsetWidth; ring.classList.add('on'); },
    cap(text, sub) { cap.style.opacity = text ? 1 : 0; if (text) cap.innerHTML = text + (sub ? '<small>' + sub + '</small>' : ''); },
    step(text) { step.style.opacity = text ? 1 : 0; if (text) step.textContent = text; },
    dialog(d) {
      if (!d) { dlg.style.display = 'none'; return; }
      dlg.querySelector('.msg').textContent = d.m;
      dlg.querySelector('.row').innerHTML = d.type === 'confirm' ? '<button>Cancelar</button><button class="ok">OK</button>' : '<button class="ok">OK</button>';
      dlg.style.display = 'flex';
    }
  };
  return 1;
})()`;

// Uma gravação: cena, cursor, legendas e quadros.
export async function createRecorder(cdp, { out, width = 1280, height = 720, scale = 1, mobile = false, capSize, capBottom, stepTop, stepRight } = {}) {
  const framesDir = path.join(out, 'frames');
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const frames = [];
  let recording = false;
  cdp.on(m => {
    if (m.method !== 'Page.screencastFrame') return;
    cdp.send('Page.screencastFrameAck', { sessionId: m.params.sessionId });
    if (!recording) return;
    const file = `f${String(frames.length).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(framesDir, file), Buffer.from(m.params.data, 'base64'));
    frames.push({ file, t: m.params.metadata.timestamp });
  });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });

  const vars = [capSize && `--tut-cap-size:${capSize}px`, capBottom && `--tut-cap-bottom:${capBottom}px`, stepTop && `--tut-step-top:${stepTop}px`, stepRight && `--tut-step-right:${stepRight}px`].filter(Boolean).join(';');
  const install = async () => { await cdp.ev(OVERLAY); if (vars) await cdp.ev(`document.documentElement.style.cssText += ${JSON.stringify(';' + vars)}; 1`); };

  const r = {
    ev: cdp.ev,
    async go(url, wait = 7000) {
      await cdp.send('Page.navigate', { url }); await sleep(wait); await install();
    },
    install,
    async waitFor(sel, ms = 15000) {
      const until = Date.now() + ms;
      while (Date.now() < until) { if (await cdp.ev(`!!(${sel})`)) return true; await sleep(400); }
      throw new Error('não apareceu: ' + sel);
    },
    async move(sel, pause = 1100) {
      const pos = await cdp.ev(`(() => { const el = ${sel}; if (!el) return null; el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return __tut.to(el); })()`);
      if (!pos) throw new Error('elemento não encontrado: ' + sel);
      await sleep(pause);
      return pos;
    },
    async click(sel, after = 900) {
      await cdp.ev(`(() => { const el = ${sel}; const q = el.getBoundingClientRect(); __tut.ring(q.left + q.width / 2, q.top + q.height / 2); setTimeout(() => el.click(), 180); return 1; })()`);
      await sleep(after);
    },
    async moveClick(sel, after = 900) { await r.move(sel); await r.click(sel, after); },
    // Mostra, uma a uma, as confirmações e avisos que o app abriu, e "clica" em OK.
    async dialogs(read = 2600) {
      const list = await cdp.ev('window.__tutDialogs.splice(0)');
      for (const d of list) {
        await cdp.ev(`__tut.dialog(${JSON.stringify(d)})`);
        await sleep(read);
        await r.moveClick(`document.querySelector('#tut-dialog button.ok')`, 500);
        await cdp.ev('__tut.dialog(null)');
        await sleep(500);
      }
      return list;
    },
    cap: (text = '', sub = '') => cdp.ev(`__tut.cap(${JSON.stringify(text)}, ${JSON.stringify(sub)})`),
    step: (text = '') => cdp.ev(`__tut.step(${JSON.stringify(text)})`),
    async scrollMain(top, wait = 1400) {
      await cdp.ev(`(() => { const scrollable = e => e && e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY); const main = document.querySelector('main'); const el = scrollable(main) ? main : ([...document.querySelectorAll('*')].find(e => scrollable(e) && !e.closest('aside, nav')) || document.scrollingElement); el.scrollTo({ top: ${top}, behavior: 'smooth' }); return 1; })()`);
      await sleep(wait);
    },
    async start() {
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: Math.round(width * scale), maxHeight: Math.round(height * scale), everyNthFrame: 1 });
      recording = true;
      await sleep(500);
    },
    async stop() {
      await r.cap(''); await r.step(''); await sleep(700);
      recording = false;
      await cdp.send('Page.stopScreencast');
      fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify({ width: Math.round(width * scale), height: Math.round(height * scale), frames }));
      return { frames: frames.length, seconds: frames.length ? +(frames.at(-1).t - frames[0].t).toFixed(1) : 0 };
    }
  };
  return r;
}

// Entra com um usuário pelo formulário de login (a senha vem de variável de ambiente).
export async function login(cdp, base, username, password) {
  if (!username || !password) throw new Error('Defina usuário e senha nas variáveis de ambiente.');
  await cdp.send('Page.navigate', { url: base + '/login' }); await sleep(2500);
  await cdp.ev(`localStorage.clear(); sessionStorage.clear(); 1`);
  await cdp.send('Page.navigate', { url: base + '/login' });
  // espera o formulário aparecer (a tela de entrada pode demorar a carregar)
  for (let i = 0; i < 30 && !(await cdp.ev(`!!document.querySelector('form input[type=password]')`)); i++) await sleep(500);
  await cdp.ev(`(() => { const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(document.querySelector('form input'), ${JSON.stringify(username)}); set(document.querySelector('form input[type=password]'), ${JSON.stringify(password)});
    setTimeout(() => document.querySelector('form button[type=submit]').click(), 200); return 1; })()`);
  await sleep(8000);
  // Gestor com mais de um hospital escolhe a unidade.
  await cdp.ev(`(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => x.innerText.trim() === 'Entrar'); b?.click(); return 1; })()`);
  await sleep(6000);
  await cdp.ev(`localStorage.setItem('hospital-intelligence-theme', 'light'); 1`);
  return cdp.ev('location.pathname');
}

// Chamada REST com a sessão do app (para devolver os dados da demo ao estado original).
export function rest(cdp, method, pathAndQuery, body) {
  return cdp.ev(`(async () => {
    const key = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k));
    const sess = JSON.parse(localStorage.getItem(key));
    const base = 'https://' + key.slice(3, key.indexOf('-auth-token')) + '.supabase.co';
    const res = await fetch(base + '/rest/v1/' + ${JSON.stringify(pathAndQuery)}, { method: ${JSON.stringify(method)}, headers: { apikey: ${JSON.stringify(process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_aJYPYrAxzbYEU23ckNDpyg_H5nbZoX_')}, Authorization: 'Bearer ' + sess.access_token, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: ${body ? JSON.stringify(JSON.stringify(body)) : 'undefined'} });
    return res.status + ' ' + (await res.text()).slice(0, 300);
  })()`);
}
