import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Dispara a redefinição de senha diretamente via Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (err) {
      // Ignorar retorno de erro no front-end para evitar enumeração de usuários (segurança)
      console.warn("Aviso de redefinição:", err.message);
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Recuperar senha"
      subtitle="Vamos enviar um link para redefinir sua senha"
      footer={
        <Link to="/login" className="text-sky-600 font-medium hover:underline flex items-center justify-center">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Voltar para login
        </Link>
      }
    >
      {sent ? (
        <div className="p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl text-center">
          <p className="text-sm text-sky-800 dark:text-sky-300 font-medium">
            Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha em breve.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 text-left">
            <Label htmlFor="email" className="font-bold text-slate-700 dark:text-slate-300">Endereço de e-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-black bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-md cursor-pointer transition-all" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Enviar link de redefinição"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}