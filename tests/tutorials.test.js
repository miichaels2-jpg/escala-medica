import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TUTORIALS, tutorialTopicsFor } from '../src/lib/tutorials.js';
import { VIDEOS } from '../scripts/tutoriais/videos.mjs';

test('cada vídeo do catálogo tem arquivo gravado e roteiro para regravar', () => {
  for (const video of TUTORIALS) {
    assert.ok(fs.existsSync(`public/tutoriais/${video.id}.webm`), `falta public/tutoriais/${video.id}.webm`);
    assert.ok(VIDEOS[video.id], `falta o roteiro de ${video.id}`);
  }
});

test('plantonista vê só os vídeos dele; gestão vê todos', () => {
  const pro = tutorialTopicsFor(false).flatMap(t => t.videos.map(v => v.id));
  assert.deepEqual(pro.sort(), ['minha-escala', 'passar-plantao', 'pegar-vaga']);
  assert.equal(tutorialTopicsFor(true).flatMap(t => t.videos).length, TUTORIALS.length);
});
