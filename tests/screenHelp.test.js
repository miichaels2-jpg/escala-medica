import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREEN_HELP, TOURS, screenHelpFor, tourForVideo } from '../src/lib/screenHelp.js';
import { findTutorial } from '../src/lib/tutorials.js';

const validSpec = spec => Boolean(spec && (spec.button || spec.buttonStarts || spec.selector));

test('cada tarefa da ajuda aponta para vídeo e guia que existem', () => {
  for (const [path, items] of Object.entries(SCREEN_HELP)) {
    for (const item of items) {
      assert.ok(item.video || item.tour, `${path}/${item.id} sem vídeo nem guia`);
      if (item.video) assert.ok(findTutorial(item.video), `vídeo ${item.video} não existe`);
      if (item.tour) assert.ok(TOURS[item.tour], `guia ${item.tour} não existe`);
      assert.ok(['gestor', 'plantonista', 'todos'].includes(item.audience));
    }
  }
});

test('todo passo de guia tem alvo válido e texto', () => {
  for (const [id, steps] of Object.entries(TOURS)) {
    assert.ok(steps.length >= 2, `${id} curto demais`);
    for (const step of steps) {
      const specs = Array.isArray(step.target) ? step.target : [step.target];
      assert.ok(specs.every(validSpec), `${id}: alvo inválido em "${step.title}"`);
      assert.ok(step.title && step.text, `${id}: passo sem título ou texto`);
    }
    assert.ok(!steps.at(-1).click, `${id}: o último passo não pode esperar clique`);
  }
});

test('plantonista vê só as tarefas dele; gestão não vê as do plantonista', () => {
  assert.deepEqual(screenHelpFor('/trocas', false).map(i => i.id), ['pegar-vaga', 'passar-plantao']);
  assert.deepEqual(screenHelpFor('/trocas', true).map(i => i.id), ['aprovar-troca']);
  assert.equal(screenHelpFor('/escalas', false).length, 0);
  assert.equal(screenHelpFor('/minha-escala', false)[0].videoInfo.id, 'minha-escala');
  assert.equal(screenHelpFor('/dashboard', true).length, 0);
});

test('"Fazer junto na tela" leva para a tela certa', () => {
  assert.equal(tourForVideo('montar-mes', true).path, '/escalas');
  assert.equal(tourForVideo('pegar-vaga', false).path, '/trocas');
  assert.equal(tourForVideo('aprovar-troca', false), null);
});
