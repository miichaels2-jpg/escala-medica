import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, Info } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function OAuthConsent() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Simulando tempo de carregamento antes de informar que a integração está inativa
    const t = setTimeout(() => {
      setChecking(false);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  if (checking) {
    return (
      <AuthLayout icon={ShieldCheck} title="Autorizando acesso...">
        <div className="flex items-center justify-center py-6 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
          Carregando permissões...
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Integração Indisponível"
      subtitle="Acesso de aplicativos de terceiros desativado."
    >
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
        <Info className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Esta plataforma foi atualizada e não utiliza mais o motor de integrações antigo.
        </p>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          ScaleMedic Native Auth
        </p>
      </div>

      <div className="mt-6">
        <Button
          onClick={() => window.location.href = '/'}
          className="w-full h-12 font-black bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white rounded-xl shadow-md cursor-pointer transition-all"
        >
          Voltar para a página inicial
        </Button>
      </div>
    </AuthLayout>
  );
}