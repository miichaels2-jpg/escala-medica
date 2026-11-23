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
// Plantão de 17/12 do Plantonista Teste: ele pede para passar e a gestão aprova.
const TEST_SHIFT_RELEASE = 'shift_teste_plantonista_4';
const TEST_PROFESSIONAL = 'prof_61dcc97d-44e2-4871-9d51-cfc7930bd424';
const asVacancy = { status: 'vago', professional_id: null, professional_name: 'Vaga Aberta', notes: '[ESP:Clínica Médica] [TESTE_PLANTONISTA]' };
const asTestShift = { status: 'confirmado', professional_id: TEST_PROFESSIONAL, professional_name: 'Plantonista Teste', notes: '[ESP:Clínica Médica] [TESTE_PLANTONISTA]' };
const escape = r => r.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
// Digita devagar num campo do formulário (React precisa do evento "input").
const type = async (r, sel, text) => {
  for (let i = 1; i <= text.length; i++) {
    await r.ev(`(() => { const el = ${sel}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(text)}.slice(0, ${i})); el.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
    await sleep(45);
  }
};

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
  },

  'passar-plantao': {
    profile: 'plantonista', view: PHONE,
    async run(r, base) {
      await r.go(base + '/trocas', 8000);
      await r.ev(`${btnStarts('Meus plantões')}?.click()`); await sleep(1500);
      const release = `[...document.querySelectorAll('button')].filter(b => b.innerText.trim() === 'Passar p/ Mural').pop()`;
      await r.ev(`${release}?.scrollIntoView({ block: 'center' })`); await sleep(600);
      await r.start();
      await r.step('Passar um plantão');
      await r.cap('Não vai poder ir? Em Mural › Meus plantões…', '…estão todos os seus próximos plantões.');
      await sleep(4200);
      await r.cap('Toque em “Passar p/ Mural” no plantão.');
      await r.moveClick(release, 900);
      await r.dialogs(3000);
      await r.cap('O pedido vai para a coordenação aprovar.', 'Enquanto isso, o plantão continua sendo seu.');
      await sleep(4500);
      await r.cap('Aprovado, ele vira vaga no Mural para os colegas.', 'Você recebe o aviso no celular. Para trocar com alguém específico, use “Propor troca”.');
      await sleep(5000);
    },
    // Se gravado sozinho, devolve o plantão (com aprovar-troca, quem devolve é ele).
    restore: cdp => rest(cdp, 'PATCH', `shifts?id=eq.${TEST_SHIFT_RELEASE}&select=id,status`, asTestShift)
  },

  'aprovar-troca': {
    profile: 'gestor', view: DESKTOP,
    async run(r, base) {
      await r.go(base + '/trocas', 8000);
      await r.start();
      await r.step('Aprovar um pedido no Mural');
      await r.cap('Quando alguém pede para passar um plantão, o pedido cai em Mural › Aprovações.');
      await r.moveClick(btnStarts('Aprovações'), 1800);
      await r.cap('Confira quem pediu, o dia e o horário.', 'Autorizar abre a vaga no Mural; Recusar mantém o plantão com a pessoa.');
      await sleep(4800);
      await r.moveClick(`[...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.innerText.trim() === 'Autorizar')`, 900);
      await r.dialogs(3000);
      await r.cap('Pronto: o plantão vira vaga no Mural.', 'Quem pediu recebe o aviso, e os colegas da mesma especialidade já podem assumir.');
      await sleep(3000);
      await r.moveClick(btnStarts('Vagas'), 1800); await sleep(3000);
    },
    restore: cdp => rest(cdp, 'PATCH', `shifts?id=eq.${TEST_SHIFT_RELEASE}&select=id,status`, asTestShift)
  },

  'cadastrar-profissional': {
    profile: 'gestor', view: DESKTOP,
    async run(r, base) {
      await r.go(base + '/corpo-clinico', 9000);
      await r.waitFor(btnStarts('Novo profissional'));
      await r.start();
      await r.step('Cadastrar um profissional');
      await r.cap('Em Corpo Clínico, clique em “Novo profissional”.', 'Ou mande o link de cadastro pelo botão “Convidar equipe”.');
      await r.moveClick(btnStarts('Novo profissional'), 1500);
      const field = n => `[...document.querySelectorAll('[role=dialog] input')].filter(i => i.type !== 'checkbox')[${n}]`;
      await r.cap('Passo 1, Dados: categoria, nome, documentos e contato.');
      await r.move(field(0), 700); await type(r, field(0), 'Ana Beatriz Rocha');
      await r.move(field(1), 600); await type(r, field(1), 'Clínica Médica');
      await r.move(`[...document.querySelectorAll('[role=dialog] input[type=date]')][0]`, 600);
      await r.ev(`(() => { const el = [...document.querySelectorAll('[role=dialog] input[type=date]')][0]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1990-04-12'); el.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
      await r.cap('A data de nascimento gera a senha do primeiro acesso.', 'Dia, mês e ano + a inicial do nome. Ela troca a senha ao entrar.');
      await sleep(3800);
      await r.moveClick(btnStarts('Próximo: Acesso'), 1500);
      await r.cap('Passo 2, Acesso: o perfil já marca as telas certas.', 'Escolha os hospitais e os setores onde a pessoa pode ser escalada.');
      await sleep(5200);
      await r.moveClick(btnStarts('Próximo: Valores'), 1500);
      await r.cap('Passo 3, Valores: quanto ela recebe em cada hospital, e o PIX.', 'Por plantão (dia, noite, fim de semana), fixo mensal ou produtividade.');
      await sleep(5200);
      await r.move(btnStarts('Cadastrar profissional'));
      await r.cap('Clique em “Cadastrar profissional” e ela já pode ser escalada.', 'Mande o link de acesso pelo WhatsApp no passo 2.');
      await sleep(4200);
      await escape(r); await sleep(800);
    }
  },

  'fechar-mes': {
    profile: 'gestor', view: DESKTOP,
    async run(r, base) {
      await r.go(base + '/faturamento', 9000);
      await r.ev(`document.querySelector('[aria-label="Mês anterior"]')?.click()`); await sleep(2500);
      await r.start();
      await r.step('Fechar o mês no Faturamento');
      await r.cap('O Faturamento calcula quanto pagar a cada profissional no mês.', 'Pelo valor cadastrado de cada um: por plantão, fixo ou produtividade.');
      await sleep(4500);
      await r.scrollMain(430, 1500);
      await r.cap('Cada linha diz onde pagar e o que falta.', '“Falta PIX ou conta”: complete no Corpo Clínico.');
      await r.move(`[...document.querySelectorAll('tbody tr td')].find(td => td.innerText.includes('Falta PIX'))`); await sleep(4200);
      await r.cap('Pagou? Marque um por um, ou vários de uma vez.');
      await r.moveClick(`document.querySelector('input[aria-label="Selecionar todos a pagar"]')`, 1200);
      await r.move(btnStarts('Marcar como pago')); await sleep(3800);
      await r.cap('Depois, o demonstrativo ou o recibo de cada um sai pronto para imprimir.', 'E “Imprimir fechamento” gera o resumo do mês para a direção.');
      await r.moveClick(btnStarts('Limpar'), 900);
      await r.move(`[...document.querySelectorAll('tbody button')].find(b => /Demonstrativo|Recibo/.test(b.innerText))`); await sleep(4500);
    }
  }
};
