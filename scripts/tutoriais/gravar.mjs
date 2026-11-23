// Grava os vídeos da tela "Como usar" e salva em public/tutoriais/<id>.webm.
//
// Uso (Chrome aberto com --remote-debugging-port=9335):
//   TUTORIAL_GESTOR_USER=... TUTORIAL_GESTOR_PASS=... \
//   TUTORIAL_PLANTONISTA_USER=... TUTORIAL_PLANTONISTA_PASS=... \
//   node scripts/tutoriais/gravar.mjs [id ou "todos"] [base]
// Senhas só por variável de ambiente; nunca ficam em arquivo.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, createRecorder, login } from './lib.mjs';
import { encode } from './encode.mjs';
import { VIDEOS } from './videos.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const which = process.argv[2] || 'todos';
const base = process.argv[3] || 'https://scalemedic-app.vercel.app';
const ids = which === 'todos' ? Object.keys(VIDEOS) : which.split(',');
const creds = {
  gestor: [process.env.TUTORIAL_GESTOR_USER, process.env.TUTORIAL_GESTOR_PASS],
  plantonista: [process.env.TUTORIAL_PLANTONISTA_USER, process.env.TUTORIAL_PLANTONISTA_PASS]
};

let current = null;
const pendingRestores = [];
for (const id of ids) {
  const video = VIDEOS[id];
  if (!video) { console.error('vídeo desconhecido:', id); process.exit(1); }
  const cdp = await connect();
  if (current !== video.profile) {
    console.log('entrando como', video.profile, '→', await login(cdp, base, ...creds[video.profile]));
    current = video.profile;
  }
  const work = path.join(os.tmpdir(), 'scalemedic-tutoriais', id);
  const r = await createRecorder(cdp, { out: work, ...video.view });
  try {
    await video.run(r, base);
  } finally {
    console.log(id, await r.stop());
    if (video.restore) pendingRestores.push(video);
  }
  // Devolve a demo ao estado original (o gestor pode; o plantonista não).
  if (video.restore && current === 'gestor') { console.log('  restaura:', await video.restore(cdp)); pendingRestores.pop(); }
  cdp.close();
  console.log('  vídeo:', await encode(work, path.join(root, 'public', 'tutoriais', `${id}.webm`)));
  current = null; // o encoder navega para outra página: entra de novo no próximo vídeo
}
if (pendingRestores.length) {
  const cdp = await connect();
  console.log('entrando como gestor para restaurar →', await login(cdp, base, ...creds.gestor));
  for (const video of pendingRestores) console.log('  restaura:', await video.restore(cdp));
  cdp.close();
}
