import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fechaOperativaHoy, compararHoraTurno } from '../lib/turnos';
import { capturarUbicacion } from '../lib/geo';

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

  async function confirmFlight({ tramoN, form, pdoRow, tramoInfo, operadorNombre, tipoVuelo }) {
    const ubic = await capturarUbicacion();

    const { data: inserted, error: insertError } = await supabase
      .from('registro_vuelos')
      .insert({
        fecha,
        halcon_n: halconN,
        tramo_n: tramoN || null,
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
        turno_manual: form.turno || null,
        ubicacion_manual: form.ubicacionManual || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const ubicacionExcel = form.ubicacionManual || tramoInfo?.nombre || '—';
    // Los "Otros Vuelos" (sin tramo) caen dentro de la zona de patrullaje de
    // dron Ñilhue–Huallalolén–Novillo Muerto–Río Mapocho, cuadrante 117,
    // salvo Servicio Farellones que es una zona aparte sin cuadrante fijo.
    const cuadranteExcel = tramoInfo?.cuadrante || (tipoVuelo && tipoVuelo !== 'Servicio Farellones' ? '117' : '—');

    try {
      fetch('/api/onedrive/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Fecha: fecha,
          Operador: `Halcón ${halconN}`,
          'Modelo De RPA': form.aeronave,
          Turno: form.turno || '—',
          Tipificacion: form.tipificacion,
          Tramo: tramoN ? 'SI' : 'NO',
          Ubicacion: ubicacionExcel,
          Cuadrante: cuadranteExcel,
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
      await marcarCompañero(pdoRow, { estado: 'Realizado' });
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
    await marcarCompañero(pdoRow, { estado: 'No realizado', motivo: motivo || null });
    await refetch();
  }

  // Cuando dos operadores comparten el mismo móvil/misión (mismo tramo, hora
  // y turno el mismo día — ver extraeDronesSinSector en CargarPDO.jsx, que
  // replica el sobrevuelo del compañero cuando el Excel deja a uno sin
  // labor propia), volaron juntos: si uno registra o descarta el vuelo, la
  // fila del compañero en pdo_dia se actualiza igual, para que no tenga que
  // repetir la marca en su propia app.
  async function marcarCompañero(pdoRow, cambios) {
    if (pdoRow.tramo_n == null) return; // solo aplica a sobrevuelos de sector
    await supabase
      .from('pdo_dia')
      .update(cambios)
      .eq('fecha', fecha)
      .eq('turno', pdoRow.turno)
      .eq('tramo_n', pdoRow.tramo_n)
      .eq('hora', pdoRow.hora)
      .neq('halcon_n', halconN);
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
