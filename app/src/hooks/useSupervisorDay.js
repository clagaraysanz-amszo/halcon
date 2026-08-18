import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fechaOperativaHoy, compararHoraTurno } from '../lib/turnos';

export function useSupervisorDay(fechaOverride) {
  const fecha = fechaOverride || fechaOperativaHoy();
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

    const pdo = pdoRes.data ?? [];
    const turnosPorOp = new Map();
    pdo.forEach((r) => turnosPorOp.set(r.halcon_n, r.turno));
    pdo.sort((a, b) => compararHoraTurno(a.hora, b.hora, a.turno));

    setPdoRows(pdo);

    const fl = flightsRes.data ?? [];
    fl.sort((a, b) => {
      const toMin = (h) => {
        const [hh, mm] = h.split(':').map(Number);
        return (hh < 7 ? hh + 24 : hh) * 60 + mm;
      };
      return toMin(b.hora_inicio) - toMin(a.hora_inicio);
    });
    setFlights(fl);
    setLoading(false);
  }, [fecha]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const pdoDone = pdoRows.filter((r) => r.estado === 'Realizado' || r.estado === 'Justificado').length;
  const pdoPend = pdoRows.filter((r) => r.estado === 'Pendiente').length;
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
