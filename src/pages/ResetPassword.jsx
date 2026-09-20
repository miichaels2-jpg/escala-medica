import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionVerified, setSessionVerified] = useState(false);

  // No Supabase, o clique no link de e-mail já inicia uma sessão no browser do usuário.
  // Precisamos garantir que essa sessão exista antes de permitir a troca da senha.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionVerified(true);
      } else {
        // Se a página atualizar muito rápido ou o link não for do tipo hash (#access_token=...), 
        // o supabase tentará trocar o código por uma sessão.
        const { hash } = window.location;
        if (!hash || (!hash.includes("access_token") && !hash.includes("type=recovery"))) {
          setError("Sessão de recuperação inválida ou expirada.");
        } else {
          setSessionVerified(true);
        }
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    
    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      // Usamos updateUser() pois o link de reset já criou uma sessão temporária validada
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;
      
      setSuccess(true);
      
      // Encerra a sessão temporária para obrigar o usuário a logar com a senha nova
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err) {
      setError(err.message || "Falha ao redefinir a senha. Tente solicitar um novo link.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout icon={CheckCircle2} title="Senha Redefinida!" subtitle="Tudo pronto.">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
          <p className="text-sm text-emerald-800 dark:text-emerald-300 font-bold">
            Sua senha foi alterada com sucesso!
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Redirecionando para o login...
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (error && !sessionVerified) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Link inválido ou expirado"
        subtitle="Não foi possível validar sua requisição"
        footer={
          <Link to="/forgot-password" className="text-sky-600 font-bold hover:underline">
            Solicitar novo link
          </Link>
        }
      >
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-center">
          <p className="text-sm text-rose-800 dark:text-rose-300 font-medium">
            O link de redefinição usado parece estar incorreto ou já expirou. 
            Por questões de segurança, solicite um novo e-mail.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="Criar nova senha"
      subtitle="Digite sua nova credencial de acesso abaixo"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold text-center">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2 text-left">
          <Label htmlFor="password" className="font-bold text-slate-700 dark:text-slate-300">Nova senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl"
              required
            />
          </div>
        </div>
        <div className="space-y-2 text-left">
          <Label htmlFor="confirm" className="font-bold text-slate-700 dark:text-slate-300">Confirmar senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl"
              required
            />
          </div>
        </div>
        <Button 
          type="submit" 
          className="w-full h-12 font-black bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-md cursor-pointer transition-all" 
          disabled={loading || !sessionVerified}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Atualizando...
            </>
          ) : (
            "Salvar nova senha e Entrar"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}