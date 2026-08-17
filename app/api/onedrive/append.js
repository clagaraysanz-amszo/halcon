import { getSupabase, getAccessToken, getArchivoActivo } from '../_lib/onedrive.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const row = req.body;
    if (!row || !row.Fecha) return res.status(400).json({ error: 'Datos incompletos' });

    const supabase = getSupabase();
    const accessToken = await getAccessToken(supabase);
    const { driveId, itemId, sheetName } = await getArchivoActivo(supabase, accessToken);

    // Buscar el rango usado para saber la siguiente fila
    const usedRangeUrl =
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}` +
      `/workbook/worksheets('${encodeURIComponent(sheetName)}')/usedRange(valuesOnly=true)`;

    const usedRes = await fetch(usedRangeUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!usedRes.ok) {
      const errText = await usedRes.text();
      throw new Error('Error al leer rango: ' + errText);
    }

    const usedData = await usedRes.json();
    const nextRow = (usedData.rowCount || 1) + 1;

    const values = [[
      row.Fecha,
      row.Operador,
      row['Modelo De RPA'],
      row.Turno,
      row.Tipificacion,
      row.Tramo,
      row.Ubicacion,
      row.Cuadrante,
      row['Duracion Vuelo'],
      row['Altura Metros'],
      row['Distancia Recorrida'],
      row.Funcionario,
    ]];

    // Escribir la fila
    const rangeAddr = `A${nextRow}:L${nextRow}`;
    const writeUrl =
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}` +
      `/workbook/worksheets('${encodeURIComponent(sheetName)}')/range(address='${rangeAddr}')`;

    const writeRes = await fetch(writeUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      throw new Error('Error al escribir fila: ' + errText);
    }

    return res.status(200).json({ ok: true, row: nextRow });
  } catch (e) {
    console.error('OneDrive append error:', e);
    return res.status(500).json({ error: e.message });
  }
}
