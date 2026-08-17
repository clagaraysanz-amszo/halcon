import { getSupabase, getAccessToken, getArchivoActivo } from '../_lib/onedrive.js';

/**
 * Endpoint de un solo uso: recorre el Excel de bitácora en OneDrive y corrige
 * dos columnas del histórico, sin tocar nada que ya esté bien:
 *   - Cuadrante (H): en filas Tramo=NO, si está vacía/"—" o dice
 *     "FARELLONES", queda en "117" (todos los Otros Vuelos, incluido
 *     Servicio Farellones, son cuadrante 117).
 *   - Distancia Recorrida (K): si es un número pelado (sin "metros"), se le
 *     agrega el sufijo " metros".
 * Idempotente: correrlo de nuevo no vuelve a tocar lo ya corregido.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const supabase = getSupabase();
    const accessToken = await getAccessToken(supabase);
    const { driveId, itemId, sheetName } = await getArchivoActivo(supabase, accessToken);

    const usedRangeUrl =
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}` +
      `/workbook/worksheets('${encodeURIComponent(sheetName)}')/usedRange(valuesOnly=true)`;
    const usedRes = await fetch(usedRangeUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!usedRes.ok) throw new Error('Error al leer rango: ' + await usedRes.text());
    const usedData = await usedRes.json();
    const rows = usedData.values || [];

    if (req.query?.debug === '1') {
      const muestra = rows
        .slice(1)
        .map((row, i) => ({ excelRow: i + 2, cuadrante: row[7], distancia: row[10] }))
        .filter((r) => {
          const c = String(r.cuadrante ?? '').toUpperCase();
          const d = String(r.distancia ?? '');
          return c.includes('FARELLONES') || /^\d+$/.test(d.trim());
        })
        .slice(0, 20);
      return res.status(200).json({ ok: true, totalFilas: rows.length, muestra });
    }

    // Columnas (0-index): 0 Fecha, 1 Operador, 2 Modelo De RPA, 3 Turno,
    // 4 Tipificacion, 5 Tramo, 6 Ubicacion, 7 Cuadrante, 8 Duracion Vuelo,
    // 9 Altura Metros, 10 Distancia Recorrida, 11 Funcionario.
    const pendientes = [];
    rows.forEach((row, idx) => {
      if (idx === 0) return; // encabezado
      const excelRow = idx + 1;

      const tramo = String(row[5] ?? '').trim().toUpperCase();
      const cuadrante = String(row[7] ?? '').trim().toUpperCase();
      if (tramo === 'NO' && (!cuadrante || cuadrante === '—' || cuadrante === '-' || cuadrante === 'FARELLONES')) {
        pendientes.push({ col: 'H', excelRow, valor: '117' });
      }

      const distancia = String(row[10] ?? '').trim();
      if (/^\d+$/.test(distancia)) {
        pendientes.push({ col: 'K', excelRow, valor: `${distancia} metros` });
      }
    });

    // Límite por invocación: cada PATCH a Graph API toma tiempo y el
    // serverless function tiene un máximo de duración. Si sobran filas,
    // conviene volver a llamar el endpoint (es idempotente) en vez de
    // arriesgar un timeout a mitad de camino.
    const LOTE_MAX = 40;
    const loteActual = pendientes.slice(0, LOTE_MAX);

    let actualizadas = 0;
    const errores = [];
    for (const p of loteActual) {
      const rangeAddr = `${p.col}${p.excelRow}:${p.col}${p.excelRow}`;
      const writeUrl =
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}` +
        `/workbook/worksheets('${encodeURIComponent(sheetName)}')/range(address='${rangeAddr}')`;
      const writeRes = await fetch(writeUrl, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[p.valor]] }),
      });
      if (writeRes.ok) {
        actualizadas++;
      } else {
        errores.push({ fila: p.excelRow, col: p.col, error: await writeRes.text() });
      }
    }

    return res.status(200).json({
      ok: true,
      filasRevisadas: rows.length - 1,
      encontradas: pendientes.length,
      procesadasEnEsteLote: loteActual.length,
      actualizadas,
      restantes: pendientes.length - loteActual.length,
      errores,
    });
  } catch (e) {
    console.error('Fix cuadrantes error:', e);
    return res.status(500).json({ error: e.message });
  }
}
