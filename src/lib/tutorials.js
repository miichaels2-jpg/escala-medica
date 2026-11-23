// Vídeos da tela "Como usar" (sem voz, com legendas). Os arquivos ficam em
// public/tutoriais/<id>.webm e são regravados por scripts/tutoriais/gravar.mjs.
export const TUTORIAL_TOPICS = [
  { id: 'escala', title: 'Montar a escala', audience: 'gestor' },
  { id: 'plantonista', title: 'Para o plantonista', audience: 'todos' }
];

export const TUTORIALS = [
  { id: 'montar-mes', topic: 'escala', title: 'Montar o mês com os turnos padrão', summary: 'Do cadastro do setor ao mês inteiro com vagas, em um clique.', seconds: 33 },
  { id: 'escalar-pela-grade', topic: 'escala', title: 'Escalar alguém pela Grade', summary: 'Clique na vaga, escolha quem pode assumir e pronto. Para desfazer, “Liberar vaga”.', seconds: 34 },
  { id: 'publicar-escala', topic: 'escala', title: 'Publicar a escala', summary: 'Quando publicar, o que o plantonista recebe e como publicar só uma parte do mês.', seconds: 25 },
  { id: 'minha-escala', topic: 'plantonista', title: 'Minha Escala no celular', summary: 'Próximo plantão, agenda do celular, ganhos do mês e folgas.', seconds: 27, vertical: true },
  { id: 'pegar-vaga', topic: 'plantonista', title: 'Pegar uma vaga no Mural', summary: 'Assumir uma vaga aberta e ver o plantão na sua escala.', seconds: 28, vertical: true }
];

export const tutorialSrc = id => `/tutoriais/${id}.webm`;

// Gestão vê tudo (inclusive o que mostrar à equipe); o plantonista vê só os vídeos dele.
export function tutorialTopicsFor(isManager) {
  return TUTORIAL_TOPICS
    .filter(topic => isManager || topic.audience === 'todos')
    .map(topic => ({ ...topic, videos: TUTORIALS.filter(v => v.topic === topic.id) }))
    .filter(topic => topic.videos.length);
}

export function findTutorial(id) {
  return TUTORIALS.find(v => v.id === id) || null;
}
