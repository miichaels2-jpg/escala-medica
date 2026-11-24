// Monta os PDFs do manual de treinamento (public/manual/*.pdf) a partir dos textos em
// scripts/manual/manuais/*.mjs e das fotos em scripts/manual/out/fotos (capturar.mjs).
//
// Uso (Chrome aberto com --remote-debugging-port=9335):
//   node scripts/manual/gerar.mjs [ids separados por vírgula | todos]
// "todos" também gera o manual completo (manual-completo.pdf).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openIsolatedTab, sleep } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const FOTOS = path.join(here, 'out', 'fotos');
const OUT = path.join(root, 'public', 'manual');
const PORT = 4189;
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const meta = JSON.parse(fs.readFileSync(path.join(FOTOS, 'fotos.json'), 'utf8'));

const files = fs.readdirSync(path.join(here, 'manuais')).filter(f => f.endsWith('.mjs')).sort();
const MANUAIS = [];
for (const f of files) MANUAIS.push((await import(pathToFileURL(path.join(here, 'manuais', f)).href)).default);

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// **negrito** e `tecla/botão` dentro dos textos
const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<span class="ui">$1</span>');

const MARK = `<svg viewBox="0 0 64 64" width="WIDTH" height="WIDTH">${[[4, 4, 0], [24, 4, 1], [44, 4, 0], [4, 24, 1], [24, 24, 1], [44, 24, 1], [4, 44, 0], [24, 44, 1], [44, 44, 0]]
  .map(([x, y, c]) => `<rect x="${x}" y="${y}" width="16" height="16" rx="5" fill="FILL" fill-opacity="${c ? 1 : 'CORNER'}"/>`).join('')}</svg>`;
const mark = (size, fill = '#fff', corner = 0.35) => MARK.replace(/WIDTH/g, size).replace(/FILL/g, fill).replace(/CORNER/g, corner);

function figure(id, { legenda, pontos = [], largura } = {}) {
  const m = meta[id];
  if (!m) throw new Error(`foto não encontrada: ${id} (rode capturar.mjs)`);
  const phone = m.view === 'cel';
  // foto alta: limita a ~150 mm de altura para caber na página com o texto
  if (!largura && !phone && m.height / m.width > 150 / 180) largura = `${Math.round(150 * m.width / m.height)}mm`;
  const marks = (m.marks || []).map((r, i) => {
    if (!r || i >= pontos.length) return '';
    const left = (r.x / m.width) * 100, top = (r.y / m.height) * 100, w = (r.w / m.width) * 100, h = (r.h / m.height) * 100;
    return `<div class="hl" style="left:${left}%;top:${top}%;width:${w}%;height:${h}%"></div><div class="num${left < 4 ? ' dentro' : ''}" style="left:${left < 4 ? left + 1 : left}%;top:${top + h / 2}%">${i + 1}</div>`;
  }).join('');
  const lista = pontos.length ? `<ol class="pontos">${pontos.map(p => `<li>${rich(p)}</li>`).join('')}</ol>` : '';
  const img = `<div class="shot ${phone ? 'phone' : ''}" style="${largura ? `width:${largura}` : ''}"><img src="/fotos/${id}.jpg">${marks}</div>`;
  const cap = legenda ? `<figcaption>${rich(legenda)}</figcaption>` : '';
  return phone && lista
    ? `<figure class="side">${img}<div>${cap}${lista}</div></figure>`
    : `<figure>${img}${cap}${lista}</figure>`;
}

function block(b) {
  if (b.p) return `<p>${rich(b.p)}</p>`;
  if (b.h) return `<h3>${rich(b.h)}</h3>`;
  if (b.figura) return figure(b.figura, b);
  if (b.lista) return `<ul>${b.lista.map(i => `<li>${rich(i)}</li>`).join('')}</ul>`;
  if (b.passos) {
    return `<ol class="passos">${b.passos.map(s => {
      const step = typeof s === 'string' ? { texto: s } : s;
      return `<li><div class="ptxt">${rich(step.texto)}</div>${step.figura ? figure(step.figura, step) : ''}</li>`;
    }).join('')}</ol>`;
  }
  if (b.dica) return `<div class="box dica"><b>Dica</b><span>${rich(b.dica)}</span></div>`;
  if (b.atencao) return `<div class="box atencao"><b>Atenção</b><span>${rich(b.atencao)}</span></div>`;
  if (b.tabela) return `<table><thead><tr>${b.tabela.cab.map(c => `<th>${rich(c)}</th>`).join('')}</tr></thead><tbody>${b.tabela.linhas.map(l => `<tr>${l.map(c => `<td>${rich(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  if (b.quebra) return '<div class="quebra"></div>';
  throw new Error('bloco desconhecido: ' + JSON.stringify(b).slice(0, 80));
}

const today = new Date().toLocaleDateString('pt-BR');

function cover(m, { completo = false } = {}) {
  return `<section class="capa">
    <div class="capa-top">${mark(54)}<span class="wm">Scale<b>Medic</b></span></div>
    <div class="capa-mid">
      <p class="kicker">Manual de treinamento${completo ? '' : ` · Módulo ${m.numero}`}</p>
      <h1>${esc(m.titulo)}</h1>
      <p class="resumo">${rich(m.resumo)}</p>
      ${m.publico ? `<p class="publico">Para: <b>${esc(m.publico)}</b></p>` : ''}
    </div>
    <div class="capa-bottom"><span>ScaleMedic V${version}</span><span>Atualizado em ${today}</span></div>
    <div class="capa-art">${mark(420, '#fff', 0.18)}</div>
  </section>`;
}

function sumario(m) {
  return `<section class="sumario"><h2>Neste manual</h2><ol>${m.secoes.map(s => `<li>${esc(s.titulo)}</li>`).join('')}</ol>
    <div class="box dica"><b>Como ler</b><span>Os números nas fotos correspondem às listas logo abaixo delas. Os nomes, e-mails e telefones das fotos são fictícios. Botões e textos da tela aparecem <span class="ui">assim</span>.</span></div></section>`;
}

function body(m, prefix = '') {
  return m.secoes.map((s, i) => `<section class="secao"><h2><span>${prefix}${i + 1}</span>${esc(s.titulo)}</h2>${s.blocos.map(block).join('\n')}</section>`).join('\n');
}

const CSS = fs.readFileSync(path.join(here, 'manual.css'), 'utf8');
const page = (title, footer, inner) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap" rel="stylesheet">
<style>${CSS}
@page { size: A4; margin: 16mm 15mm 18mm; @bottom-left { content: "${footer}"; font: 8pt Inter, sans-serif; color: #64748b; } @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Inter, sans-serif; color: #64748b; } }
@page :first { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }
</style></head><body>${inner}</body></html>`;

function htmlFor(m) {
  return page(`ScaleMedic · ${m.titulo}`, `ScaleMedic · Manual de treinamento · ${m.titulo.replace(/"/g, '')}`, cover(m) + sumario(m) + body(m));
}

function htmlCompleto(list) {
  const capa = { titulo: 'Manual completo do ScaleMedic', resumo: 'Todas as telas, passo a passo: da primeira entrada ao fechamento do mês.', publico: 'Gestão, faturamento e plantonistas' };
  const toc = `<section class="sumario"><h2>Módulos</h2><ol>${list.map(m => `<li><b>${esc(m.titulo)}</b><br><span class="muted">${rich(m.resumo)}</span></li>`).join('')}</ol></section>`;
  const parts = list.map(m => `<section class="abre-modulo"><p class="kicker">Módulo ${m.numero}</p><h1>${esc(m.titulo)}</h1><p class="resumo">${rich(m.resumo)}</p></section>${body(m, `${m.numero}.`)}`).join('\n');
  return page('ScaleMedic · Manual completo', 'ScaleMedic · Manual de treinamento · Manual completo', cover(capa, { completo: true }) + toc + parts);
}

// Servidor local: a página e as fotos (o Chrome imprime o PDF).
let currentHtml = '';
const server = http.createServer((req, res) => {
  if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(currentHtml); }
  if (req.url.startsWith('/fotos/')) {
    const file = path.join(FOTOS, path.basename(decodeURIComponent(req.url)));
    if (fs.existsSync(file)) { res.writeHead(200, { 'content-type': 'image/jpeg' }); return res.end(fs.readFileSync(file)); }
  }
  res.writeHead(404); res.end();
}).listen(PORT);

const tab = await openIsolatedTab();
async function render(html, outFile) {
  currentHtml = html;
  await tab.send('Page.navigate', { url: `http://localhost:${PORT}/` });
  await sleep(2500);
  await tab.ev('document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))))');
  const { result } = await tab.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(result.data, 'base64'));
  return Math.round(fs.statSync(outFile).size / 1024);
}

const which = process.argv[2] || 'todos';
const chosen = which === 'todos' ? MANUAIS : MANUAIS.filter(m => which.split(',').includes(m.id));
for (const m of chosen) console.log(`${m.id}.pdf`, await render(htmlFor(m), path.join(OUT, `${m.id}.pdf`)), 'KB');
if (which === 'todos') console.log('manual-completo.pdf', await render(htmlCompleto(MANUAIS), path.join(OUT, 'manual-completo.pdf')), 'KB');
// catálogo para a tela "Material de treinamento"
fs.writeFileSync(path.join(OUT, 'catalogo.json'), JSON.stringify({ versao: version, atualizado: today, manuais: MANUAIS.map(({ id, numero, titulo, resumo, publico }) => ({ id, numero, titulo, resumo, publico })) }, null, 1));
await tab.dispose();
server.close();
