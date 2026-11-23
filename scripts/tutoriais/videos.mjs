// Roteiros dos vídeos da tela "Como usar". Cada um usa os dados da demo e não deixa
// rastro: o que muda durante a gravação volta ao estado original (restore).
// Os textos de catálogo (título, descrição) ficam em src/lib/tutorials.js.
import { sleep, rest } from './lib.mjs';

const DESKTOP = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 760, scale: 1.5, mobile: true, capSize: 15, capBottom: 92, stepTop: 70, stepRight: 12 };
const btn = text => `[...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.innerText.trim() === ${JSON.stringify(text)})`;
const btnStarts = text => `[...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.innerText.trim().startsWith(${JSON.stringify(text)}))`;

// Vaga de teste da demo (Enfermaria / Clínica Médica, 05/12 e 12/12, não publicadas: ninguém é avisado).
const TEST_VACANCY_DAY = 'shift_teste_plantonista_5';
const TEST_VACANCY_NIGHT = 'shift_teste_plantonista_6';
const asVacancy = { status: 'vago', professional_id: null, professional_name: 'Vaga Aberta', notes: '[ESP:Clínica Médica] [TESTE_PLANTONISTA]' };

export const VIDEOS = {
  'escalar-pela-grade': {
    profile: 'gestor', view: DESKTOP,
    async run(r, base) {
      await r.go(base + '/escalas', 8000);
      await r.ev(`document.querySelector('[aria-label="Próximo mês"]')?.click()`); await sleep(1500);
      await r.ev(`${btnStarts('Enfermaria / Clínica')}?.click()`); await sleep(1200);
      await r.ev(`${btn('Grade')}?.click()`); await sleep(1500);
      const vacancy = `[...document.querySelectorAll('section button[title="Vaga em aberto: clique para escalar"]')][0]`;
      await r.ev(`${vacancy}?.scrollIntoView({ block: 'center' })`); await sleep(800);
      await r.start();
      await r.step('Como escalar alguém pela Grade');
      await r.cap('Na Escala, a visão Grade mostra o mês inteiro.', 'Cada linha é um turno do setor; cada coluna, um dia.');
      await sleep(4200);
      await r.cap('Quadrado tracejado é vaga em aberto.', 'Clique nela para escolher quem vai cobrir.');
      const pos = await r.move(vacancy); await sleep(1400);
      await r.click(vacancy, 1700);
      await r.cap('Aparecem só os profissionais que podem assumir:', 'mesma especialidade, liberados no setor e sem choque de horário.');
      await sleep(4200);
      const cand = `[...document.querySelectorAll('[role=dialog] button')].find(b => b.innerText.includes('Plantonista Teste'))`;
      await r.move(cand); await r.cap('Clique no nome para escalar.'); await sleep(1300);
      await r.click(cand, 2200);
      await r.cap('Pronto: o plantão já aparece na Grade com a sigla da pessoa.', 'Com a escala publicada, o profissional recebe o aviso no celular.');
      await sleep(4800);
      const filled = `[...document.querySelectorAll('section button[title^="Plantonista Teste"]')].find(b => { const q = b.getBoundingClientRect(); return Math.abs(q.left + q.width / 2 - ${pos[0]}) < 4 && Math.abs(q.top + q.height / 2 - ${pos[1]}) < 4; })`;
      await r.cap('Errou? Clique no nome na Grade…');
      await r.moveClick(filled, 1300);
      await r.cap('…e use “Liberar vaga”. A vaga volta para o Mural.');
      await r.moveClick(btn('Liberar vaga'), 2500);
      await r.cap('É assim que se monta o mês, vaga por vaga.', 'Dica: “Montar turnos do mês” cria todas as vagas de uma vez.');
      await sleep(4500);
    },
    restore: cdp => rest(cdp, 'PATCH', `shifts?id=eq.${TEST_VACANCY_DAY}&select=id,status`, asVacancy)
  },

  'montar-mes': {
    profile: 'gestor', view: DESKTOP,
    async run(r, base) {
      await r.go(base + '/setores', 8000);
      await r.ev(`[...document.querySelectorAll('h3')].find(h => h.innerText.trim() === 'UTI Adulto')?.scrollIntoView({ block: 'center' })`); await sleep(800);
      const card = `[...document.querySelectorAll('h3')].find(h => h.innerText.trim() === 'UTI Adulto').closest('.rounded-3xl')`;
      await r.start();
      await r.step('Montar o mês com os turnos padrão');
      await r.cap('Em Setores, cada setor guarda os seus turnos fixos.', 'Ex.: UTI com 2 vagas de dia (07–19) e 1 de noite (19–07). Cadastre em “Editar”.');
      await r.move(`[...${card}.querySelectorAll('dd')][0]`); await sleep(4200);
      await r.cap('Para montar o mês, clique em “Montar mês”.');
      await r.moveClick(`[...${card}.querySelectorAll('button')].find(b => b.innerText.includes('Montar mês'))`, 6000);
      await r.waitFor(`[...document.querySelectorAll('[role=dialog]')].find(d => d.innerText.includes('Montar escala'))`);
      await r.cap('O gerador já abre com os turnos do setor e o mês inteiro.', 'Dá para mudar horários, vagas e o período antes de continuar.');
      await sleep(5000);
      await r.moveClick(btnStarts('Próximo: escolher profissionais'), 2500);
      await r.cap('Agora escolha quem fica em cada vaga, ou deixe vaga aberta para o Mural.', 'Nada é gravado até você salvar como rascunho ou publicar.');
      await sleep(5500);
      await r.cap('Pronto: o mês inteiro montado de uma vez.', 'Depois, ajuste vaga por vaga na Grade.');
      await sleep(3500);
      await r.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await sleep(800);
    }
  },

  'publicar-escala': {
    profile: 'gestor', view: DESKTOP,
    async run(r, base) {
      await r.go(base + '/escalas', 8000);
      await r.ev(`document.querySelector('[aria-label="Próximo mês"]')?.click()`); await sleep(1500);
      await r.ev(`${btnStarts('Enfermaria / Clínica')}?.click()`); await sleep(1200);
      await r.ev(`${btn('Grade')}?.click()`); await sleep(1200);
      await r.start();
      await r.step('Publicar a escala');
      await r.cap('Enquanto você monta, a escala é rascunho.', 'Os profissionais ainda não veem nem recebem aviso.');
      await r.move(`[...document.querySelectorAll('p, span')].find(e => e.innerText?.includes('rascunho, ainda não publicada'))`); await sleep(3800);
      await r.cap('Quando estiver pronta, clique em “Publicar”.');
      await r.moveClick(btnStarts('Publicar'), 1800);
      await r.cap('Confira o setor e o período (o mês inteiro, 15 ou 7 dias).', 'Dá para publicar aos poucos: só a primeira quinzena, por exemplo.');
      await r.move(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.innerText.trim() === 'Mês Inteiro')`); await sleep(4200);
      await r.cap('Ao confirmar, cada profissional escalado recebe o aviso no celular.', 'E a escala passa a aparecer para ele em Minha Escala.');
      await r.move(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.className.includes('bg-emerald-600'))`); await sleep(5000);
      await r.cap('Mudou algo depois? Quem foi afetado é avisado na hora.');
      await sleep(3500);
      await r.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await sleep(800);
    }
  },

  'minha-escala': {
    profile: 'plantonista', view: PHONE,
    async run(r, base) {
      await r.go(base + '/minha-escala', 8000);
      await r.start();
      await r.step('Minha Escala');
      await r.cap('Ao entrar, você cai na sua escala.', 'O próximo plantão fica em destaque, com o endereço.');
      await sleep(4200);
      await r.cap('“Adicionar à agenda” leva todos os plantões para o calendário do celular.', 'Com lembrete 12 h e 1 h antes.');
      await r.move(btnStarts('Adicionar à agenda')); await sleep(4200);
      await r.cap('Mais abaixo, quanto você já fez e tem a receber no mês.');
      await r.scrollMain(560, 1800); await sleep(3200);
      await r.cap('Vai tirar férias ou folga? Informe aqui.', 'A coordenação não vai te escalar nesses dias.');
      await r.scrollMain(1080, 1800); await sleep(3600);
      await r.cap('E a lista de todos os seus próximos plantões.', 'Precisa passar um? Use “Passar no Mural”.');
      await r.scrollMain(1500, 1800); await sleep(4200);
    }
  },

  'pegar-vaga': {
    profile: 'plantonista', view: PHONE,
    async run(r, base) {
      await r.go(base + '/trocas', 8000);
      const card = `[...document.querySelectorAll('button')].filter(b => b.innerText.trim() === 'Assumir').pop()`;
      await r.start();
      await r.step('Pegar uma vaga no Mural');
      await r.cap('No Mural ficam as vagas que você pode assumir.', 'Só da sua especialidade e sem choque com a sua escala.');
      await sleep(4500);
      await r.cap('Gostou de uma? Toque em “Assumir”.');
      await r.moveClick(card, 900);
      await r.cap('Confirme e pronto.');
      await r.dialogs(2800);
      await r.cap('O plantão já é seu.', 'Aparece em Meus plantões e em Minha Escala.');
      await r.moveClick(btnStarts('Meus plantões'), 1500); await sleep(3500);
      await r.cap('Se surgir uma vaga para você, chega o aviso no celular.', 'Ative em Avisos no sino, no topo da tela.');
      await sleep(4000);
    },
    restore: cdp => rest(cdp, 'PATCH', `shifts?id=eq.${TEST_VACANCY_NIGHT}&select=id,status`, asVacancy)
  }
};
