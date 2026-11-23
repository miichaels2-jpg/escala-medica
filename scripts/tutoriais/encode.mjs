// Monta o WebM a partir dos quadros gravados, dentro do próprio Chrome (MediaRecorder),
// sem precisar de ffmpeg. 30 quadros por segundo; o último quadro segura meio segundo.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { connect, sleep } from './lib.mjs';

export async function encode(dir, outFile, { bitrate = 1200000, port = 4188 } = {}) {
  const { width, height, frames } = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'));
  const t0 = frames[0].t;
  const picked = [];
  for (const f of frames) if (!picked.length || f.t - picked[picked.length - 1].t >= 1 / 30) picked.push(f);
  const timeline = picked.map((f, i) => ({ src: '/frames/' + f.file, at: f.t - t0, until: (picked[i + 1]?.t ?? f.t + 0.5) - t0 }));

  const page = `<!doctype html><meta charset="utf-8"><canvas id="c" width="${width}" height="${height}"></canvas><script>
  const tl = ${JSON.stringify(timeline)};
  (async () => {
    const imgs = await Promise.all(tl.map(f => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = f.src; })));
    const c = document.getElementById('c'); const g = c.getContext('2d');
    g.drawImage(imgs[0], 0, 0, ${width}, ${height});
    const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: ${bitrate} });
    const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = async () => { await fetch('/save', { method: 'POST', body: new Blob(chunks, { type: 'video/webm' }) }); document.title = 'pronto'; };
    rec.start(1000);
    const start = performance.now(); let i = 0;
    const tick = () => {
      const now = (performance.now() - start) / 1000;
      while (i < tl.length - 1 && tl[i + 1].at <= now) i++;
      g.drawImage(imgs[i], 0, 0, ${width}, ${height});
      if (now < tl[tl.length - 1].until) requestAnimationFrame(tick); else rec.stop();
    };
    requestAnimationFrame(tick);
  })();
  </script>`;

  let saved = false;
  const server = http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
    if (req.url.startsWith('/frames/')) { res.writeHead(200, { 'content-type': 'image/jpeg' }); return res.end(fs.readFileSync(path.join(dir, 'frames', path.basename(req.url)))); }
    if (req.url === '/save' && req.method === 'POST') {
      const parts = []; req.on('data', d => parts.push(d)); req.on('end', () => { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, Buffer.concat(parts)); saved = true; res.end('ok'); });
      return;
    }
    res.writeHead(404); res.end();
  }).listen(port);

  const cdp = await connect();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: Math.min(width, 1600), height: Math.min(height, 1600), deviceScaleFactor: 1, mobile: false });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp.send('Page.navigate', { url: `http://localhost:${port}/` });
  const limit = Date.now() + (timeline.at(-1).until + 90) * 1000;
  while (!saved && Date.now() < limit) await sleep(1500);
  cdp.close(); server.close();
  if (!saved) throw new Error('o vídeo não foi gerado');
  return { file: outFile, kb: Math.round(fs.statSync(outFile).size / 1024), seconds: +timeline.at(-1).until.toFixed(1) };
}
