// Ferramentas do manual: conectar numa aba do Chrome (CDP), achar elementos como o guia da tela,
// trocar dados pessoais reais por fictícios antes de cada foto.
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function connectTo(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: false });
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.slice(0, 200));
  });
  const send = (method, params = {}) => new Promise(r => { const i = ++seq; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erro no script da página');
    return r.result?.result?.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  return { send, ev, errors, close: () => ws.close() };
}

// Abre uma aba numa sessão própria (sem misturar o login do gestor com o do plantonista).
export async function openIsolatedTab(port = 9335) {
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const browser = await connectTo(version.webSocketDebuggerUrl);
  const { result: { browserContextId } } = await browser.send('Target.createBrowserContext', { disposeOnDetach: false });
  const { result: { targetId } } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId });
  await sleep(800);
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = list.find(t => t.id === targetId);
  const tab = await connectTo(target.webSocketDebuggerUrl);
  tab.dispose = async () => {
    tab.close();
    await browser.send('Target.closeTarget', { targetId });
    await browser.send('Target.disposeBrowserContext', { browserContextId });
    browser.close();
  };
  return tab;
}

// Mesmo formato de alvo do guia da tela (src/lib/screenHelp.js), mais { aria: '...' }.
export const FIND_JS = `window.__find = (target) => {
  const visible = el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const text = el => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
  const one = (spec, root) => {
    if (spec.aria) return [...root.querySelectorAll('[aria-label="' + spec.aria + '"]')].find(visible) || null;
    if (spec.button || spec.buttonStarts) {
      const want = spec.button || spec.buttonStarts;
      return [...root.querySelectorAll('button, [role=menuitem], [role=tab], a')].find(b => visible(b) && (spec.button ? text(b) === want : text(b).startsWith(want))) || null;
    }
    if (spec.selector) {
      const all = [...root.querySelectorAll(spec.selector)].filter(el => visible(el) && (!spec.includes || text(el).includes(spec.includes)));
      return (spec.last ? all.pop() : all[spec.index || 0]) || null;
    }
    return null;
  };
  for (const spec of Array.isArray(target) ? target : [target]) {
    const roots = spec.inDialog ? [...document.querySelectorAll('[role=dialog]')] : [document];
    for (const root of roots) { const el = one(spec, root); if (el) return el; }
  }
  return null;
};
window.__rect = (target, pad = 6) => { const el = window.__find(target); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }; };
1;`;

// Nomes fictícios: mesma inicial do nome real (as siglas da Grade continuam batendo).
const FIRST = { A: 'Ana', B: 'Bruno', C: 'Carla', D: 'Daniel', E: 'Elisa', F: 'Fernanda', G: 'Gustavo', H: 'Helena', I: 'Igor', J: 'Juliana', K: 'Karina', L: 'Lucas', M: 'Marina', N: 'Natália', O: 'Otávio', P: 'Paulo', R: 'Renata', S: 'Sérgio', T: 'Tatiana', U: 'Úrsula', V: 'Vítor', W: 'Wagner', Y: 'Yara', Z: 'Zeca' };
const LAST = { A: 'Andrade', B: 'Barros', C: 'Cardoso', D: 'Duarte', E: 'Esteves', F: 'Freitas', G: 'Gomes', H: 'Holanda', I: 'Inácio', J: 'Jardim', L: 'Lacerda', M: 'Mendes', N: 'Nogueira', O: 'Oliveira', P: 'Prado', R: 'Ribeiro', S: 'Sampaio', T: 'Teixeira', V: 'Vasconcelos', W: 'Werneck', Y: 'Yamada', Z: 'Zanetti' };
const MIDDLE = ['Costa', 'Rocha', 'Lima', 'Moura', 'Pires', 'Reis', 'Campos', 'Fonseca'];
// palavras que também aparecem na tela: nunca são trocadas
const KEEP = new Set(['Gestor', 'Geral', 'Hospital', 'Santa', 'Clara', 'Vida', 'Saúde', 'Dois', 'Usuário', 'Usuario', 'usuário', 'usuario', 'Médico', 'Medico', 'médico', 'medico', 'Admin', 'Administrador', 'Plantonista', 'Teste', 'teste', 'Demo', 'Faturamento', 'Coordenação', 'Enfermeiro', 'Técnico', 'Escala', 'Setor', 'Principal']);
// Contas de teste ("Plantonista Teste", "medico teste"): troca o nome inteiro, nunca as palavras
// soltas (senão "Médico(a)" e "Usuário" da tela também mudariam).
const TEST_NAMES = ['Paulo Teixeira', 'Marcos Teles', 'Mariana Toledo', 'Ursula Tavares', 'Ivo Torres', 'Beatriz Tavares'];

export function buildNameMap(realNames) {
  const tokens = new Map();
  let k = 0;
  let t = 0;
  for (const name of realNames) {
    const full = String(name || '').trim();
    if (full.split(/\s+/).every(w => ['Gestor', 'Geral', 'Admin', 'Administrador'].includes(w))) continue; // ex.: Gestor Geral
    if (/teste|demo/i.test(full) || full.split(/\s+/).some(w => KEEP.has(w))) {
      if (!tokens.has(full)) tokens.set(full, full === 'Plantonista Teste' ? 'Paulo Teixeira' : TEST_NAMES[1 + (t++ % (TEST_NAMES.length - 1))]);
      continue;
    }
    const parts = full.split(/\s+/).filter(Boolean);
    parts.forEach((part, i) => {
      if (part.length < 3 || KEEP.has(part) || tokens.has(part)) return;
      const letter = part.normalize('NFD').replace(/[̀-ͯ]/g, '')[0].toUpperCase();
      let fake;
      if (i === 0) fake = FIRST[letter] || 'Alex';
      else if (i === parts.length - 1) fake = LAST[letter] || 'Souza';
      else fake = MIDDLE[(k++) % MIDDLE.length];
      const cased = part === part.toLowerCase() ? fake.toLowerCase() : part === part.toUpperCase() ? fake.toUpperCase() : fake;
      tokens.set(part, cased);
    });
  }
  return [...tokens.entries()].sort((a, b) => b[0].length - a[0].length);
}

// Troca nomes, e-mails, telefones e CPFs na tela (só o que aparece; nada é salvo) e esconde logos de clientes.
export const scrubJs = tokenPairs => `(() => {
  const pairs = ${JSON.stringify(tokenPairs)};
  const esc = s => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
  const map = new Map(pairs); const rule = pairs.length ? new RegExp('(?<![\\\\p{L}])(' + pairs.map(([a]) => esc(a)).join('|') + ')(?![\\\\p{L}])', 'gu') : null;
  const emails = new Map(); const fakeMail = m => { if (!emails.has(m)) emails.set(m, ['ana.andrade', 'carla.cardoso', 'paulo.prado', 'marina.mendes', 'lucas.lacerda', 'juliana.jardim', 'renata.ribeiro'][emails.size % 7] + '@exemplo.com.br'); return emails.get(m); };
  const fix = s => {
    let out = s;
    if (rule) out = out.replace(rule, m => map.get(m) ?? m); // uma passada: o nome trocado não é trocado de novo
    out = out.replace(/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/g, fakeMail);
    out = out.replace(/\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}/g, '123.456.789-00');
    out = out.replace(/https?:\\/\\/localhost:\\d+/g, 'https://scalemedic.com.br'); // foto tirada da versão local
    out = out.replace(/\\(?\\b\\d{2}\\)?\\s?9?\\d{4}-?\\d{4}\\b/g, m => (m.includes('3456-7890') ? m : '(11) 98765-4321'));
    out = out.replace(/\\b\\d{10,11}\\b/g, '11987654321');
    return out;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) { const v = fix(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
  for (const el of document.querySelectorAll('input, textarea')) { if (el.type === 'password') continue; const v = fix(el.value || ''); if (v !== el.value) el.value = v; const p = fix(el.placeholder || ''); if (p !== el.placeholder) el.placeholder = p; }
  for (const el of document.querySelectorAll('[title]')) el.title = fix(el.title);
  // logo de cliente (enviada pelo hospital) vira um espaço neutro
  const placeholder = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-dasharray="4 3"/><text x="60" y="35" font-family="Arial" font-size="11" fill="#64748b" text-anchor="middle">Logo do hospital</text></svg>');
  for (const img of document.querySelectorAll('img')) if (/^data:image\\/(png|jpe?g|webp)|supabase\\.co\\/storage/.test(img.src)) img.src = placeholder;
  // itens internos do dono do sistema não aparecem no manual
  for (const a of document.querySelectorAll('a[href="/plataforma"], a[href="/planejamento"], a[href="/treinamento"]')) a.style.display = 'none';
  return nodes.length;
})()`;
