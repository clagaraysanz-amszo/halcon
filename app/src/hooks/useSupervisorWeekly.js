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

function parseLocal(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function useSupervisorWeekly(fechaRef) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const ref = fechaRef ? parseLocal(fechaRef) : new Date();
    const monday = getMonday(ref);
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(toISODate(d));
    }
    const desde = weekDates[0];
    const hasta = weekDates[6];

    const [flightsRes, pdoRes] = await Promise.all([
      supabase
        .from('registro_vuelos')
        .select('fecha, halcon_n, minutos, tramo_n, turno_manual, aeronave')
        .gte('fecha', desde)
        .lte('fecha', hasta),
      supabase
        .from('pdo_dia')
        .select('fecha, halcon_n, estado, turno')
        .gte('fecha', desde)
        .lte('fecha', hasta),
    ]);

    const flights = flightsRes.data ?? [];
    const pdo = pdoRes.data ?? [];

    const operadores = new Set();
    flights.forEach((f) => operadores.add(f.halcon_n));
    pdo.forEach((p) => operadores.add(p.halcon_n));

    const porOperador = [...operadores]
      .filter((h) => !h.startsWith('S'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((halconN) => {
        const opFlights = flights.filter((f) => f.halcon_n === halconN);
        const opPdo = pdo.filter((p) => p.halcon_n === halconN);
        const totalVuelos = opFlights.length;
        const totalMinutos = opFlights.reduce((a, f) => a + f.minutos, 0);
        const totalAsignados = opPdo.length;
        const totalRealizados = opPdo.filter((p) => p.estado === 'Realizado').length;
        const totalNoRealizados = opPdo.filter((p) => p.estado === 'No realizado').length;
        const tasa = totalAsignados > 0 ? Math.round((totalRealizados / totalAsignados) * 100) : null;
        const turnos = new Set(opFlights.map((f) => f.turno_manual).filter(Boolean));

        const days = weekDates.map((fecha, i) => {
          const dFlights = opFlights.filter((f) => f.fecha === fecha);
          const dPdo = opPdo.filter((p) => p.fecha === fecha);
          return {
            fecha,
            label: DIAS_CORTOS[i],
            vuelos: dFlights.length,
            minutos: dFlights.reduce((a, f) => a + f.minutos, 0),
            asignados: dPdo.length,
            realizados: dPdo.filter((p) => p.estado === 'Realizado').length,
          };
        });

        return { halconN, totalVuelos, totalMinutos, totalAsignados, totalRealizados, totalNoRealizados, tasa, turnos: [...turnos], days };
      });

    const totales = {
      vuelos: flights.filter((f) => !f.halcon_n.startsWith('S')).length,
      minutos: flights.filter((f) => !f.halcon_n.startsWith('S')).reduce((a, f) => a + f.minutos, 0),
      asignados: pdo.filter((p) => !p.halcon_n.startsWith('S')).length,
      realizados: pdo.filter((p) => !p.halcon_n.startsWith('S') && p.estado === 'Realizado').length,
    };
    totales.tasa = totales.asignados > 0 ? Math.round((totales.realizados / totales.asignados) * 100) : null;

    const porDia = weekDates.map((fecha, i) => {
      const dFlights = flights.filter((f) => f.fecha === fecha && !f.halcon_n.startsWith('S'));
      const dPdo = pdo.filter((p) => p.fecha === fecha && !p.halcon_n.startsWith('S'));
      return {
        fecha,
        label: DIAS_CORTOS[i],
        vuelos: dFlights.length,
        minutos: dFlights.reduce((a, f) => a + f.minutos, 0),
        realizados: dPdo.filter((p) => p.estado === 'Realizado').length,
        asignados: dPdo.length,
      };
    });

    const porTurno = {};
    for (const t of ['A', 'B', 'N']) {
      const tFlights = flights.filter((f) => f.turno_manual === t && !f.halcon_n.startsWith('S'));
      const tPdo = pdo.filter((p) => p.turno === t && !p.halcon_n.startsWith('S'));
      porTurno[t] = {
        vuelos: tFlights.length,
        minutos: tFlights.reduce((a, f) => a + f.minutos, 0),
        asignados: tPdo.length,
        realizados: tPdo.filter((p) => p.estado === 'Realizado').length,
      };
    }

    const semanaLabel = `${weekDates[0].slice(5)} al ${weekDates[6].slice(5)}`;

    setData({ porOperador, totales, porDia, porTurno, semanaLabel, weekDates });
    setLoading(false);
  }, [fechaRef]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading };
}
