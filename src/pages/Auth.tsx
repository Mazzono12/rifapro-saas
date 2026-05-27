import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, Github } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useAuthStore } from "../store/useAuthStore";

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { signIn, signUp, loading } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(name, email, password);
      }

      toast.success("Autenticação realizada com sucesso", {
        description: isLogin ? "Bem-vindo de volta ao sistema." : "Seu acesso foi criado e autorizado."
      });
      const role = useAuthStore.getState().profile?.role;
      navigate(role === 'superadmin' ? '/superadmin' : role === 'tenant_admin' ? '/admin' : '/dashboard');
    } catch (error) {
      toast.error("Falha na autenticação", {
        description: error instanceof Error ? error.message : "Verifique seus dados e tente novamente."
      });
    }
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-start justify-center px-4 pb-8 pt-4 sm:pt-6 md:items-center lg:py-8">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8 md:p-10 relative overflow-hidden">
          {/* Cyberpunk decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/10 blur-[50px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-neon-purple/10 blur-[50px] rounded-full pointer-events-none" />

          <div className="text-center mb-10 relative z-10">
            <h1 className="text-3xl font-bold font-display mb-2">
              {isLogin ? 'Bem-vindo de volta' : 'Criar nova conta'}
            </h1>
            <p className="text-slate-400 text-sm">
              {isLogin ? 'Acesse suas rifas e prêmios.' : 'Junte-se à plataforma mais avançada.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Seu nome"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-cyber-900/50"
                      required={!isLogin}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="email" 
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-cyber-900/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Senha</label>
                {isLogin && (
                  <a href="#" className="text-xs text-neon-cyan hover:text-cyan-400 transition-colors">
                    Esqueceu a senha?
                  </a>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-cyber-900/50"
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full neon-button py-3.5 rounded-xl flex items-center justify-center gap-2 mt-8 disabled:opacity-60">
              {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Cadastrar'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="mt-8 relative z-10 text-center">
            <p className="text-sm text-slate-400">
              {isLogin ? 'Ainda não tem conta?' : 'Já possui uma conta?'}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-white hover:text-neon-cyan transition-colors font-medium"
              >
                {isLogin ? 'Cadastre-se' : 'Faça login'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
