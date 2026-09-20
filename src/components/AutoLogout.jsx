import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AutoLogout({ timeoutMinutes = 60 }) {
  useEffect(() => {
    let timeoutId;
    const tempoLimite = timeoutMinutes * 60 * 1000;

    const fazerLogout = async () => {
      console.log('Tempo de inatividade atingido. Encerrando sessão por segurança...');
      
      // 1. Desloga do Supabase
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Erro ao encerrar sessão no Supabase:', err);
      }

      // 2. Limpa todos os dados locais
      window.localStorage.removeItem('scale_logged_user');
      window.localStorage.removeItem('escala_medica_session');
      window.localStorage.clear();
      
      // 3. Força um reload completo da página para redirecionar ao login
      window.location.href = '/login';
    };

    const resetarTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(fazerLogout, tempoLimite);
    };

    // Monitora interações do usuário
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

  return null;
}