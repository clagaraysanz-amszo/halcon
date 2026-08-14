import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [operador, setOperador] = useState(undefined);
  const [operadorError, setOperadorError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setOperador(null);
      return;
    }
    let cancelled = false;
    setOperador(undefined);
    supabase
      .from('operadores')
      .select('*')
      .ilike('email', session.user.email)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setOperadorError(error);
        setOperador(data ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      operador, // undefined = cargando, null = sin fila en operadores
      operadorError,
      isSupervisor: operador?.rol === 'Supervisor',
      loading: session === undefined || (!!session && operador === undefined),
      signInWithPassword: (email, password) =>
        supabase.auth.signInWithPassword({ email, password }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, operador, operadorError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
