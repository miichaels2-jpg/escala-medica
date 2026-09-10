import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, ShieldCheck, ArrowRight, CalendarClock, Stethoscope, BarChart3, MapPin, Sparkles, UserRound, Building2, Download, MessageCircleMore } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";

const floatingBubbles = [
  { icon: ShieldCheck, label: 'Cobertura 24h', tone: 'sky', position: 'card-top-left' },
  { icon: CalendarClock, label: 'Escalas em tempo real', tone: 'violet', position: 'card-top-right' },
  { icon: BarChart3, label: 'Faturamento e metas', tone: 'emerald', position: 'card-bottom-left' },
  { icon: Stethoscope, label: 'Equipe médica integrada', tone: 'amber', position: 'card-bottom-right' },
];

const features = [
  { icon: CalendarClock, title: 'Escala inteligente', text: 'Planejamento automático de turnos e cobertura por especialidade.' },
  { icon: BarChart3, title: 'Gestão financeira', text: 'Acompanhe faturamento, repasses e metas em um painel claro.' },
  { icon: ShieldCheck, title: 'Controle e segurança', text: 'Centralize acesso, convites e reconhecimento do time em um ambiente seguro.' },
];

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 'R$ 0',
    description: 'Até 3 profissionais ativos',
    highlight: false,
    badge: 'Para testar',
    cta: 'Começar grátis',
    info: 'Ideal para clínicas iniciais, consultórios pequenos e equipes em fase de organização.',
    features: ['Até 3 profissionais', 'Escalas básicas', 'Acompanhamento de plantões', 'Suporte por e-mail']
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 79',
    description: 'Por colaborador / mês',
    highlight: true,
    badge: 'Mais usado',
    cta: 'Quero esse',
    info: 'A partir do 4º profissional, o cliente paga por colaborador em uso. Estrutura simples, clara e escalável.',
    features: ['Tudo do Free', 'Escala em tempo real', 'Faturamento por profissional', 'Relatórios e exportação', 'App mobile completo']
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sob consulta',
    description: 'Para redes e grupos com customização',
    highlight: false,
    badge: 'Custom',
    cta: 'Solicitar consultoria',
    info: 'Para múltiplas unidades, integração, suporte dedicado e regras especiais de operação.',
    features: ['Múltiplas unidades', 'Suporte premium', 'Integrações e automações', 'Estratégia de operação personalizada']
  },
];

export default function Login() {
  const [username, setUsername] = useState("mdevils");
  const [password, setPassword] = useState("Bomberman12.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaUsernamePassword(username, password);
      // Sincroniza o usuário no AuthContext antes de navegar
      await checkUserAuth();
      // Redireciona diretamente para o painel restrito
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || "Usuário ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", `${window.location.origin}/dashboard`);
  };

  const handleAppDownload = () => {
    const userAgent = navigator.userAgent || "";
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

    const targetUrl = isAndroid
      ? "https://play.google.com/store/apps"
      : isIOS
        ? "https://www.apple.com/br/app-store/"
        : "https://www.scalemedic.com.br/";

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const handleWhatsAppQuote = () => {
    window.open(
      "https://wa.me/5511999999999?text=Ol%C3%A1%2C%20quero%20fazer%20uma%20cotação%20da%20ScaleMedic%20CGT.",
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleSelectPlan = (planId) => {
    setSelectedPlan(planId);
    const plan = plans.find((item) => item.id === planId);
    if (plan) {
      document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const target = document.getElementById('detalhe-plano');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  const activePlan = plans.find((plan) => plan.id === selectedPlan) || plans[1];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),transparent_35%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-sky-100/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight text-slate-900">ScaleMedic</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Escala médica</div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#home" className="transition hover:text-sky-700">Home</a>
            <a href="#escala-medica" className="transition hover:text-sky-700">Escala</a>
            <a href="#planos" className="transition hover:text-sky-700">Preços</a>
            <a href="#contato" className="transition hover:text-sky-700">Contato</a>
          </nav>

          <Button asChild variant="outline" className="rounded-full border-sky-200 bg-white text-sky-700 hover:bg-sky-50">
            <Link to="/register">Quero testar</Link>
          </Button>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <section id="home" className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="relative z-10 space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                Plataforma moderna
              </div>

              <div className="space-y-5">
                <h1 className="max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl xl:text-6xl">
                  Organize sua clínica, sua equipe e seu crescimento em um único lugar.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-slate-600">
                  A ScaleMedic centraliza escalas médicas, gestão de profissionais, faturamento e acompanhamento em tempo real para acelerar o dia a dia do seu negócio.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <button onClick={handleAppDownload} className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700">
                  <Download className="h-4 w-4" />
                  Solicitar demo
                </button>
                <button onClick={() => window.open('/mobile-preview', '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700">
                  Ver app no celular <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-3 pt-2 text-sm text-slate-600">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  3.000+ plantões organizados
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  +98% visibilidade
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Android e iPhone
                </span>
                <button onClick={handleWhatsAppQuote} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                  <MessageCircleMore className="h-3.5 w-3.5" />
                  Cotação no WhatsApp
                </button>
              </div>

              <div className="flex flex-wrap gap-6 pt-4 text-sm text-slate-600">
                <div>
                  <div className="text-2xl font-black text-slate-900">24h</div>
                  <div>Operação continua</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900">+98%</div>
                  <div>Visibilidade da equipe</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900">1 painel</div>
                  <div>Todos os processos</div>
                </div>
              </div>
            </div>

            <div className="home-visual-shell relative mx-auto w-full max-w-lg">
              {floatingBubbles.map(({ icon: Icon, label, tone, position }) => (
                <div key={label} className={`floating-card floating-card-${tone} ${position}`}>
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
              ))}

              <div className="relative overflow-hidden rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_30px_80px_rgba(14,116,144,0.14)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Acesso</div>
                    <h2 className="mt-2 text-2xl font-black text-slate-900">Entrar</h2>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                    <LogIn className="h-5 w-5" />
                  </div>
                </div>

                <Button 
                  type="button"
                  variant="outline" 
                  onClick={handleGoogle} 
                  className="mb-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <GoogleIcon className="h-5 w-5" />
                  Continuar com Google
                </Button>

                <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  ou
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {error && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium text-slate-700">Usuário</Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="username"
                        type="text"
                        autoComplete="username"
                        placeholder="mdevils"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 text-slate-900"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium text-slate-700">Senha</Label>
                      <Link to="/forgot-password" className="text-xs font-medium text-sky-700 hover:underline">
                        Esqueci a senha
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 text-slate-900"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="h-12 w-full rounded-xl bg-sky-600 text-white shadow-lg shadow-sky-200 hover:bg-sky-700" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </form>

                <p className="mt-5 text-center text-sm text-slate-500">
                  Ainda não tem conta?{" "}
                  <Link to="/register" className="font-semibold text-sky-700 hover:underline">
                    Criar conta
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="escala-medica" className="border-t border-sky-100 bg-white/60 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                <CalendarClock className="h-3.5 w-3.5" />
                Escala médica
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Mais controle para cada plantão, equipe e especialidade.
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <div key={title} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-sky-100">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 py-20 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
                <BarChart3 className="h-3.5 w-3.5" />
                Como funciona
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                Tudo o que o gestor precisa em uma única operação.
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                { title: '1. Planeje', text: 'Crie escalas com cobertura e especialidade por unidade, setor e turno.' },
                { title: '2. Confirme', text: 'Profissionais recebem plantões, validam presença e acompanham tudo pelo app.' },
                { title: '3. Controle', text: 'Acompanhe faturamento, repasses e indicadores em um painel enxuto e claro.' }
              ].map((item) => (
                <div key={item.title} className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300 font-black">
                    {item.title.split('.')[0]}
                  </div>
                  <h3 className="text-xl font-black text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="planos" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Modelo de precificação
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Estrutura simples, com clareza e escala de crescimento.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.id;

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full rounded-[28px] border p-6 text-left shadow-sm transition duration-200 hover:-translate-y-1 ${
                    plan.highlight
                      ? 'border-sky-200 bg-sky-600 text-white shadow-sky-200/60'
                      : isSelected
                        ? 'border-sky-300 bg-sky-50 text-slate-900 shadow-md shadow-sky-100'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-sky-200 hover:shadow-md hover:shadow-sky-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className={`text-xl font-black ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      plan.highlight ? 'bg-white/15 text-sky-100' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {plan.badge}
                    </span>
                  </div>

                  <div className="mt-6 flex items-end gap-1">
                    <span className={`text-4xl font-black ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                    <span className={`pb-1 text-sm ${plan.highlight ? 'text-sky-100' : 'text-slate-500'}`}>{plan.price.includes('Sob') ? '' : '/mês'}</span>
                  </div>

                  <p className={`mt-4 text-sm leading-6 ${plan.highlight ? 'text-sky-100' : 'text-slate-600'}`}>{plan.description}</p>

                  <ul className={`mt-6 space-y-3 text-sm ${plan.highlight ? 'text-sky-50' : 'text-slate-600'}`}>
                    {plan.features.map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>

                  <div className={`mt-8 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
                    plan.highlight ? 'bg-white text-sky-700 hover:bg-sky-50' : 'bg-sky-600 text-white hover:bg-sky-700'
                  }`}>
                    {plan.cta}
                  </div>
                </button>
              );
            })}
          </div>

          <div id="detalhe-plano" className="mt-10 rounded-[28px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-6 shadow-sm lg:p-8">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Plano selecionado</p>
                <h3 className="mt-3 text-3xl font-black text-slate-900">{activePlan.name}</h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{activePlan.info}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {activePlan.features.map((feature) => (
                    <span key={feature} className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-700">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl shadow-sky-100">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-slate-300">Estrutura sugerida</span>
                  <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                    {activePlan.badge}
                  </span>
                </div>
                <div className="text-4xl font-black">{activePlan.price}</div>
                <div className="mt-2 text-sm text-slate-300">{activePlan.description}</div>
                <div className="mt-6 space-y-3 text-sm text-slate-200">
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <span>Até 3 profissionais</span>
                    <strong className="text-white">Grátis</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <span>4º profissional em diante</span>
                    <strong className="text-white">R$ 79/mês</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <span>Suporte e operação</span>
                    <strong className="text-white">Incluído</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contato" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[28px] border border-sky-100 bg-sky-950 p-8 text-white shadow-[0_20px_60px_rgba(14,116,144,0.25)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                Fale conosco
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-tight">Vamos transformar a sua operação?</h2>
              <p className="mt-4 text-sm leading-7 text-sky-100/80">
                Nossa equipe ajuda clínicas, consultórios e grupos médicos a sair do caos operacional e criar uma gestão mais eficiente, previsível e lucrativa.
              </p>

              <div className="mt-8 space-y-4 text-sm text-sky-50">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-sky-300" />
                  contato@scalemedic.com.br
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-sky-300" />
                  São Paulo · Brasil
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button onClick={handleAppDownload} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-white/10">
                    <Download className="h-3.5 w-3.5" />
                    Baixar app
                  </button>
                  <button onClick={handleWhatsAppQuote} className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 hover:bg-emerald-500/20">
                    <MessageCircleMore className="h-3.5 w-3.5" />
                    WhatsApp
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Contato</div>
                  <h3 className="text-xl font-black text-slate-900">Solicite uma demonstração</h3>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="nome" className="mb-2 block text-sm font-medium text-slate-700">Nome</Label>
                  <Input id="nome" placeholder="Seu nome" className="h-12 rounded-xl border-slate-200 bg-slate-50" />
                </div>
                <div>
                  <Label htmlFor="empresa" className="mb-2 block text-sm font-medium text-slate-700">Empresa</Label>
                  <Input id="empresa" placeholder="Sua empresa" className="h-12 rounded-xl border-slate-200 bg-slate-50" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">E-mail</Label>
                  <Input id="email" type="email" placeholder="nome@empresa.com" className="h-12 rounded-xl border-slate-200 bg-slate-50" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="mensagem" className="mb-2 block text-sm font-medium text-slate-700">Mensagem</Label>
                  <textarea id="mensagem" rows={5} placeholder="Conte como você quer evoluir sua operação..." className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300" />
                </div>
              </div>

              <Button className="mt-6 h-12 rounded-xl bg-sky-600 px-6 text-white shadow-lg shadow-sky-200 hover:bg-sky-700">
                Enviar mensagem
              </Button>
            </div>
          </div>
        </section>
      </main>

      <button
        type="button"
        onClick={handleWhatsAppQuote}
        aria-label="Fazer cotação por WhatsApp"
        className="whatsapp-float"
      >
        <MessageCircleMore className="h-6 w-6" />
      </button>
    </div>
  );
}