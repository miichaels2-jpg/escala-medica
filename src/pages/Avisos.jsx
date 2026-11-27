import { useAppData } from '@/lib/useAppData';
import PageHero from '@/components/PageHero';
import AnnouncementsCard from '@/components/AnnouncementsCard';
import AnnouncementsInbox from '@/components/AnnouncementsInbox';

// Quadro de avisos (V0.10.3): todos os comunicados ficam guardados aqui. A coordenação publica e
// acompanha quem leu; o profissional lê e marca "Li".
export default function Avisos() {
  const { isManager, currentProfessional, allCompanySectors = [] } = useAppData();
  const linked = currentProfessional?.id && currentProfessional.id !== 'temp_user_id';
  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      <PageHero title="Avisos" subtitle={isManager ? 'Comunicados para a equipe: publique e veja quem já leu.' : 'Comunicados da coordenação para você e para a sua equipe.'} />
      {isManager && <AnnouncementsCard limit={50} />}
      {linked && <AnnouncementsInbox professional={currentProfessional} sectors={allCompanySectors} page={!isManager} />}
    </div>
  );
}
