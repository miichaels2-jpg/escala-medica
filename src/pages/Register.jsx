import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [idade, setIdade] = useState("");
  const [cbo, setCbo] = useState("");
  const [accountRole, setAccountRole] = useState("Gestor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    if (!fullName.trim()) {
      setError("Informe o nome completo.");
      return;
    }

    if (!cpf.trim()) {
      setError("Informe o CPF.");
      return;
    }

    if (!idade || Number(idade) <= 0) {
      setError("Informe a idade corretamente.");
      return;
    }

    if (!cbo.trim()) {
      setError("Informe o CBO.");
      return;
    }

    setLoading(true);
    try {
      await base44.auth.register({
        email,
        password,
        full_name: fullName,
        role: accountRole,
        accountRole,
        cpf,
        idade: Number(idade),
        cbo,
      });
      setShowOtp(true);
      toast({ title: "Código enviado", description: "Enviamos um código de verificação para o seu e-mail." });
    } catch (err) {
      setError(err.message || "Falha ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Código de verificação inválido.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: "Código enviado",
        description: "Verifique seu e-mail para receber o novo código.",
      });
    } catch (err) {
      setError(err.message || "Falha ao reenviar o código.");
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", safeReturnTo());
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verifique seu e-mail"
        subtitle={`Enviamos um código para ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verificando...
            </>
          ) : (
            "Verificar"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Não recebeu o código?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Reenviar
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),transparent_35%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[32px] border border-sky-100 bg-white shadow-[0_30px_80px_rgba(14,116,144,0.12)] lg:grid-cols-[1fr_1.1fr]">
        <div className="hidden bg-sky-950 p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sky-200">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-black">ScaleMedic</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-sky-200/80">Escala médica</div>
              </div>
            </div>

            <div className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/80">Crie sua conta</p>
              <h1 className="mt-4 max-w-sm text-4xl font-black leading-tight">Organize a sua operação com inteligência.</h1>
            </div>
          </div>

          <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">✓</div>
              <div>
                <div className="font-semibold">Escala inteligente</div>
                <div className="text-sm text-sky-100/80">Controle de plantões em tempo real</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">✓</div>
              <div>
                <div className="font-semibold">Gestão financeira</div>
                <div className="text-sm text-sky-100/80">Faturamento, repasses e acompanhamento</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300">✓</div>
              <div>
                <div className="font-semibold">App mobile completo</div>
                <div className="text-sm text-sky-100/80">Pedindo presença e confirmando escala</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8 lg:p-10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Cadastro</div>
              <h2 className="mt-2 text-3xl font-black text-slate-900">Crie sua conta</h2>
            </div>
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Demo
            </div>
          </div>

          <Button
            variant="outline"
            className="mb-6 h-12 w-full rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleGoogle}
          >
            <GoogleIcon className="mr-2 h-5 w-5" />
            Continuar com Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.22em] text-slate-400">
              <span className="bg-white px-3">ou</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">Nome completo</Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                autoFocus
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-medium text-slate-700">CPF</Label>
                <Input
                  id="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idade" className="text-sm font-medium text-slate-700">Idade</Label>
                <Input
                  id="idade"
                  type="number"
                  min="18"
                  placeholder="30"
                  value={idade}
                  onChange={(e) => setIdade(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cbo" className="text-sm font-medium text-slate-700">CBO</Label>
              <Input
                id="cbo"
                type="text"
                placeholder="Ex.: 2231-05"
                value={cbo}
                onChange={(e) => setCbo(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountRole" className="text-sm font-medium text-slate-700">Permissão da conta</Label>
              <select
                id="accountRole"
                value={accountRole}
                onChange={(e) => setAccountRole(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300"
              >
                <option value="Gestor">Gestor</option>
                <option value="Profissional">Profissional</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-sm font-medium text-slate-700">Repetir senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="h-12 w-full rounded-xl bg-sky-600 text-white shadow-lg shadow-sky-200 hover:bg-sky-700" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Já tem uma conta?{' '}
            <Link
              to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
              className="font-semibold text-sky-700 hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
