import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, FileText, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-12 font-sans selection:bg-sky-200 dark:selection:bg-sky-900 transition-colors">
      <div className="max-w-4xl mx-auto">
        
        {/* Cabeçalho */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/login">
            <Button variant="outline" className="h-10 w-10 p-0 rounded-xl cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-sky-600" /> Política de Privacidade e Termos de Uso
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
              Conformidade com a LGPD (Lei nº 13.709/2018)
            </p>
          </div>
        </div>

        {/* Documento Jurídico */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-10 shadow-sm space-y-8 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          
          <section>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-sky-600" /> 1. Aceitação dos Termos
            </h2>
            <p>
              Ao acessar e utilizar a plataforma <strong>ScaleMedic</strong>, o Usuário (seja gestor, coordenador, médico, enfermeiro ou assistencial) concorda integralmente com as condições descritas neste documento. Caso não concorde com qualquer diretriz, o uso da plataforma deve ser imediatamente interrompido.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Lock className="w-5 h-5 text-sky-600" /> 2. Coleta e Tratamento de Dados (LGPD)
            </h2>
            <p className="mb-3">
              Em estrita conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018)</strong>, declaramos que a ScaleMedic atua como Operadora de Dados, fornecendo a infraestrutura tecnológica para a gestão de escalas hospitalares. A instituição de saúde contratante atua como Controladora dos Dados.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Dados Pessoais Coletados:</strong> Nome completo, CPF, RG, data de nascimento e contatos (e-mail, telefone).</li>
              <li><strong>Dados Profissionais:</strong> Número de registro no conselho de classe (CRM, COREN, etc.), especialidade, e regime de contratação.</li>
              <li><strong>Dados Financeiros Sensíveis:</strong> Dados bancários, chaves PIX e informações de faturamento (CNPJ), utilizados estritamente para o cálculo de repasses e honorários vinculados aos plantões realizados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">3. Finalidade do Tratamento de Dados</h2>
            <p>
              Os dados fornecidos são utilizados de forma exclusiva para o funcionamento do ecossistema hospitalar, incluindo:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>Organização de escalas médicas e alocação de profissionais em unidades hospitalares.</li>
              <li>Comunicação oficial sobre troca de plantões, furos e passagens de turno.</li>
              <li>Geração de relatórios operacionais para auditoria da instituição de saúde.</li>
              <li>Cálculo de produtividade e processamento das informações de repasse financeiro.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">4. Armazenamento e Segurança</h2>
            <p>
              Empregamos protocolos rígidos de segurança da informação, criptografia em trânsito e em repouso. O acesso aos dados é compartimentado; profissionais assistenciais têm acesso apenas à sua própria escala, enquanto gestores possuem visões consolidadas das unidades que administram.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">5. Direitos do Titular</h2>
            <p>
              Conforme o art. 18 da LGPD, o Usuário tem o direito de solicitar a qualquer momento a exibição, retificação ou exclusão de seus dados pessoais através do departamento de Recursos Humanos/Administração da unidade hospitalar vinculada.
            </p>
          </section>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-xs font-bold text-slate-400">
              Última atualização: Setembro de 2026<br/>
              ScaleMedic Enterprise Ltda.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}