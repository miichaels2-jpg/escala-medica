import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AutoLogout({ timeoutMinutes = 60 }) {
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId;
    const tempoLimite = timeoutMinutes * 60 * 1000;

    const fazerLogout = () => {
      // Limpa os dados de acesso salvos na máquina
      window.localStorage.removeItem('escala_medica_session');
      window.localStorage.clear();
      
      // Redireciona o usuário pra tela de login
      navigate('/login');
    };

    const resetarTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(fazerLogout, tempoLimite);
    };

    // Fica de olho em qualquer movimento no sistema
    window.addEventListener('mousemove', resetarTimer);
    window.addEventListener('mousedown', resetarTimer);
    window.addEventListener('keypress', resetarTimer);
    window.addEventListener('scroll', resetarTimer, true);
    window.addEventListener('touchstart', resetarTimer);

    // Inicia a contagem
    resetarTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetarTimer);
      window.removeEventListener('mousedown', resetarTimer);
      window.removeEventListener('keypress', resetarTimer);
      window.removeEventListener('scroll', resetarTimer, true);
      window.removeEventListener('touchstart', resetarTimer);
    };
  }, [navigate, timeoutMinutes]);

  // Esse componente é "invisível", ele roda no fundo
  return null;
}