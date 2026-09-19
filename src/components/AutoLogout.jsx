import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function AutoLogout({ timeoutMinutes = 60 }) {
  useEffect(() => {
    let timeoutId;
    const tempoLimite = timeoutMinutes * 60 * 1000;

    const fazerLogout = async () => {
      console.log('Tempo de inatividade atingido. Encerrando sessão por segurança...');
      
      // 1. Tenta deslogar do servidor (backend)
      try {
        if (base44?.auth?.logout) {
          await base44.auth.logout();
        }
      } catch (err) {
        console.error('Erro ao deslogar no backend:', err);
      }

      // 2. Limpa todos os dados locais
      window.localStorage.removeItem('scale_logged_user');
      window.localStorage.removeItem('escala_medica_session');
      window.localStorage.clear();
      
      // 3. Força um reload completo da página para destruir a sessão em memória (AuthContext)
      window.location.href = '/login';
    };

    const resetarTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(fazerLogout, tempoLimite);
    };

    // Monitora qualquer interação do usuário com a página
    window.addEventListener('mousemove', resetarTimer);
    window.addEventListener('mousedown', resetarTimer);
    window.addEventListener('keypress', resetarTimer);
    window.addEventListener('scroll', resetarTimer, true);
    window.addEventListener('touchstart', resetarTimer);
    window.addEventListener('click', resetarTimer);

    // Inicia a contagem
    resetarTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetarTimer);
      window.removeEventListener('mousedown', resetarTimer);
      window.removeEventListener('keypress', resetarTimer);
      window.removeEventListener('scroll', resetarTimer, true);
      window.removeEventListener('touchstart', resetarTimer);
      window.removeEventListener('click', resetarTimer);
    };
  }, [timeoutMinutes]);

  // Componente fantasma (não renderiza nada na tela)
  return null;
}