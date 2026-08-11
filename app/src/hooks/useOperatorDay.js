import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fechaOperativaHoy, compararHoraTurno } from '../lib/turnos';
import { capturarUbicacion } from '../lib/geo';

/**
 * Datos del día operativo para UN operador: sus asignaciones del PDO de hoy
 * (todos los turnos, aunque normalmente es uno) y sus vuelos registrados hoy.
 * Ver README §5 (reglas de negocio).
 */
export function useOperatorDay(halconN) {
  const fecha = fechaOperativaHoy();
  const [pdoRows, setPdoRows] = useState([]);
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!halconN) return;
    setLoading(true);
    const [pdoRes, flightsRes] = await Promise.all([
      supabase
        .from('pdo_dia')
        .select('*')
        .eq('halcon_n', halconN)
        .eq('fecha', fecha)
        .order('hora', { ascending: true }),
      supabase
        .from('registro_vuelos')
        .select('*')
        .eq('halcon_n', halconN)
        .eq('fecha', fecha)
        .order('hora_inicio', { ascending: false }),
    ]);
    if (pdoRes.error) setError(pdoRes.error);
    else if (flightsRes.error) setError(flightsRes.error);
    else setError(null);
    const pdo = pdoRes.data ?? [];
    const turnoDetected = pdo[0]?.turno ?? null;
    if (turnoDetected === 'N') {
      pdo.sort((a, b) => compararHoraTurno(a.hora, b.hora, 'N'));
    }
    setPdoRows(pdo);
    setFlights(flightsRes.data ?? []);
    setLoading(false);
  }, [halconN, fecha]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /**
   * Confirma un vuelo: inserta en registro_vuelos y, si vino de una
   * asignación del PDO, marca esa fila como 'Realizado' (README §5.3).
   */
  async function confirmFlight({ tramoN, form, pdoRow, tramoInfo, operadorNombre }) {
    // Captura de GPS silenciosa (README §7). No bloquea el guardado: si el
    // operador niega el permiso o no hay señal, `ubic` es null y se guarda igual.
    const ubic = await capturarUbicacion();

    const { data: inserted, error: insertError } = await supabase
      .from('registro_vuelos')
      .insert({
        fecha,
        halcon_n: halconN,
        tramo_n: tramoN,
        altura: form.altura,
        minutos: form.minutos,
        distancia: form.distancia || null,
        aeronave: form.aeronave,
        tipificacion: form.tipificacion,
        estado: form.estado,
        observaciones: form.observaciones || null,
        hora_inicio: form.horaInicio,
        pdo_id: pdoRow?.id ?? null,
        latitud: ubic?.lat ?? null,
        longitud: ubic?.lng ?? null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Enviar a OneDrive en segundo plano (no bloquea el guardado)
    try {
      fetch('/api/onedrive/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Fecha: fecha,
          Operador: `Halcón ${halconN}`,
          'Modelo De RPA': form.aeronave,
          Turno: pdoRow?.turno || '—',
          Tipificacion: form.tipificacion,
          Tramo: tramoN ? 'SI' : 'NO',
          Ubicacion: tramoInfo?.nombre || '—',
          Cuadrante: tramoInfo?.cuadrante || '—',
          'Duracion Vuelo': `${form.minutos} minutos`,
          'Altura Metros': form.altura,
          'Distancia Recorrida': form.distancia || '—',
          Funcionario: operadorNombre || '—',
        }),
      }).catch(() => {});
    } catch (_) {}

    if (pdoRow) {
      const { error: updateError } = await supabase
        .from('pdo_dia')
        .update({ estado: 'Realizado' })
        .eq('id', pdoRow.id);
      if (updateError) throw updateError;
    }

    await refetch();
    return inserted;
  }

  async function markNoRealizado(pdoRow, motivo) {
    const { error: updateError } = await supabase
      .from('pdo_dia')
      .update({ estado: 'No realizado', motivo: motivo || null })
      .eq('id', pdoRow.id);
    if (updateError) throw updateError;
    await refetch();
  }

  const pdoPend = pdoRows.filter((r) => r.estado === 'Pendiente').length;
  const pdoDone = pdoRows.length - pdoPend;
  const turno = pdoRows[0]?.turno ?? null;
  const diaLibre = pdoRows.length === 0;
  const realizadosCount = flights.filter((f) => f.estado === 'Realizado').length;

  return {
    fecha,
    pdoRows,
    flights,
    loading,
    error,
    turno,
    diaLibre,
    pdoPend,
    pdoDone,
    vuelosHoy: flights.length,
    realizadosCount,
    confirmFlight,
    markNoRealizado,
    refetch,
  };
}
