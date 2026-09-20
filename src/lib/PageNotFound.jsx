import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error || !user) return { user: null, isAuthenticated: false };
                return { user, isAuthenticated: true };
            } catch (error) {
                return { user: null, isAuthenticated: false };
            }
        }
    });

    const isAdmin = authData?.user?.role === 'admin' || authData?.user?.user_metadata?.app_role === 'gestor';

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl">
                <div className="text-center space-y-6">
                    <div className="space-y-2">
                        <h1 className="text-7xl font-black text-slate-200 dark:text-slate-800 tracking-tighter">404</h1>
                        <div className="h-1 w-16 bg-sky-500 mx-auto rounded-full"></div>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-2xl font-black">
                            Página não encontrada
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            A página <span className="font-bold text-slate-700 dark:text-slate-200">"{pageName || 'inicial'}"</span> não foi encontrada neste aplicativo.
                        </p>
                    </div>

                    {isFetched && authData.isAuthenticated && isAdmin && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-left">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Observação do Administrador</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Isso pode significar que a rota ou componente correspondente ainda não foi implementada no sistema.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="inline-flex items-center justify-center w-full px-5 py-3 text-xs font-black text-white bg-sky-600 hover:bg-sky-500 rounded-2xl shadow-lg shadow-sky-600/30 transition-all cursor-pointer"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Voltar para o Painel Principal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}