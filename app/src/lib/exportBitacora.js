import * as XLSX from 'xlsx';

export function descargarBitacora(flights, pdoRows, fecha, tramosByN, operadoresByHalcon) {
  const turnoDeOp = new Map();
  pdoRows.forEach((r) => turnoDeOp.set(r.halcon_n, r.turno));

  const rows = flights.map((f) => {
    const tramo = tramosByN.get(f.tramo_n);
    const op = operadoresByHalcon.get(f.halcon_n);
    const esTramo = f.tramo_n != null;
    return {
      Fecha: fecha,
      Operador: `Halcón ${f.halcon_n}`,
      'Modelo De RPA': f.aeronave || '3TD',
      Turno: turnoDeOp.get(f.halcon_n) || '—',
      Tipificacion: esTramo ? `Tramo Nº ${f.tramo_n}` : (f.tipificacion || '—'),
      Tramo: esTramo ? 'SI' : 'NO',
      'Ubicación': tramo?.nombre || '—',
      Cuadrante: tramo?.cuadrante || '—',
      'Duracion Vuelo': `${f.minutos} minutos`,
      'Altura  Metros': `${f.altura} metros`,
      'Distancia Recorrida': '—',
      FUNCIONARIO: op?.nombre || `Halcón ${f.halcon_n}`,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bitacora');

  const [, mm, dd] = fecha.split('-');
  XLSX.writeFile(wb, `Bitacora_${dd}-${mm}-${fecha.slice(0, 4)}.xlsx`);
}
