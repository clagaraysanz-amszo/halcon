import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const CatalogContext = createContext(null);

// Dato maestro (69 tramos, 9 operadores): se carga una sola vez por sesión
// y se consulta en memoria desde todas las pantallas.
export function CatalogProvider({ children }) {
  const { session } = useAuth();
  const [tramos, setTramos] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase.from('tramos').select('*').order('tramo_n'),
      supabase.from('operadores').select('*'),
    ]).then(([tramosRes, operadoresRes]) => {
      if (cancelled) return;
      if (tramosRes.error) setError(tramosRes.error);
      else if (operadoresRes.error) setError(operadoresRes.error);
      setTramos(tramosRes.data ?? []);
      setOperadores(operadoresRes.data ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = useMemo(() => {
    const tramosByN = new Map(tramos.map((t) => [t.tramo_n, t]));
    const operadoresByHalcon = new Map(operadores.map((o) => [o.halcon_n, o]));
    return { tramos, operadores, tramosByN, operadoresByHalcon, loading, error };
  }, [tramos, operadores, loading, error]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog debe usarse dentro de <CatalogProvider>');
  return ctx;
}
