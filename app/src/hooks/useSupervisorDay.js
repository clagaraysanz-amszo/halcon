import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fechaOperativaHoy } from '../lib/turnos';

/**
 * Datos del día operativo para el Panel de Supervisión: PDO de hoy
 * (todos los turnos) y vuelos registrados hoy (todos los operadores).
 * Solo funcionarios que figuran en el PDO de hoy participan en las
 * métricas (README §5.7).
 */
export function useSupervisorDay() {
  const fecha = fechaOperativaHoy();
  const [pdoRows, setPdoRows] = useState([]);
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [pdoRes, flightsRes] = await Promise.all([
      supabase.from('pdo_dia').select('*').eq('fecha', fecha).order('hora', { ascending: true }),
      supabase
        .from('registro_vuelos')
        .select('*')
        .eq('fecha', fecha)
        .order('hora_inicio', { ascending: false }),
    ]);
    if (pdoRes.error) setError(pdoRes.error);
    else if (flightsRes.error) setError(flightsRes.error);
    else setError(null);
    setPdoRows(pdoRes.data ?? []);
    setFlights(flightsRes.data ?? []);
    setLoading(false);
  }, [fecha]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const pdoDone = pdoRows.filter((r) => r.estado === 'Realizado').length;
  const pdoPend = pdoRows.length - pdoDone;
  const totalMinutos = flights.reduce((acc, f) => acc + f.minutos, 0);

  return {
    fecha,
    pdoRows,
    flights,
    loading,
    error,
    pdoDone,
    pdoPend,
    pdoTotal: pdoRows.length,
    totalMinutos,
    refetch,
  };
}
