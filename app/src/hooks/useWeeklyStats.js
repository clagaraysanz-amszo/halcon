import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toISODate } from '../lib/turnos';

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function buildWeekDates(now = new Date()) {
  const monday = getMonday(now);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(toISODate(d));
  }
  return dates;
}

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function useWeeklyStats(halconN) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!halconN) return;
    setLoading(true);

    const weekDates = buildWeekDates();
    const desde = weekDates[0];
    const hasta = weekDates[6];

    const [flightsRes, pdoRes] = await Promise.all([
      supabase
        .from('registro_vuelos')
        .select('fecha, minutos, tramo_n, tipificacion')
        .eq('halcon_n', halconN)
        .gte('fecha', desde)
        .lte('fecha', hasta),
      supabase
        .from('pdo_dia')
        .select('fecha, estado')
        .eq('halcon_n', halconN)
        .gte('fecha', desde)
        .lte('fecha', hasta),
    ]);

    const flights = flightsRes.data ?? [];
    const pdo = pdoRes.data ?? [];

    const days = weekDates.map((fecha, i) => {
      const dayFlights = flights.filter((f) => f.fecha === fecha);
      const dayPdo = pdo.filter((p) => p.fecha === fecha);
      const realizados = dayPdo.filter((p) => p.estado === 'Realizado').length;
      return {
        fecha,
        label: DIAS_CORTOS[i],
        vuelos: dayFlights.length,
        minutos: dayFlights.reduce((a, f) => a + f.minutos, 0),
        tramosAsignados: dayPdo.length,
        tramosRealizados: realizados,
      };
    });

    const totalVuelos = flights.length;
    const totalMinutos = flights.reduce((a, f) => a + f.minutos, 0);
    const totalAsignados = pdo.length;
    const totalRealizados = pdo.filter((p) => p.estado === 'Realizado').length;
    const tasaCumplimiento = totalAsignados > 0 ? Math.round((totalRealizados / totalAsignados) * 100) : 0;

    setStats({ days, totalVuelos, totalMinutos, totalAsignados, totalRealizados, tasaCumplimiento });
    setLoading(false);
  }, [halconN]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { stats, loading, refetch };
}
