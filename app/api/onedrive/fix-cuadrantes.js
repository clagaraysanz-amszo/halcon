import { createClient } from '@supabase/supabase-js';

function encodeShareUrl(url) {
  const base64 = Buffer.from(url, 'utf-8').toString('base64');
  return 'u!' + base64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
}

async function getAccessToken(supabase) {
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
  const tenantId = process.env.ONEDRIVE_TENANT_ID;

  const { data: rtRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'onedrive_refresh_token')
    .single();

  if (!rtRow) throw new Error('No hay refresh_token. Autoriza primero en /api/auth/login');

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: rtRow.value,
        grant_type: 'refresh_token',
        scope: 'offline_access Files.ReadWrite',
      }),
    }
  );

  const tokens = await tokenRes.json();
  if (!tokens.access_token) throw new Error('Token refresh falló: ' + JSON.stringify(tokens));

  if (tokens.refresh_token) {
    await supabase.from('app_config').upsert({
      key: 'onedrive_refresh_token',
      value: tokens.refresh_token,
    }, { onConflict: 'key' });
  }

  return tokens.access_token;
}

/**
 * Endpoint de un solo uso: recorre el Excel de bitácora en OneDrive y rellena
 * la columna Cuadrante (H) solo en filas con Tramo=NO cuya celda esté vacía
 * o en "—" (nunca toca filas que ya tengan un dato). Servicio Farellones
 * recibe "FARELLONES"; el resto de Otros Vuelos recibe "117" (zona de
 * patrullaje Ñilhue–Huallalolén–Novillo Muerto–Río Mapocho).
 * Idempotente: correrlo de nuevo no vuelve a tocar lo ya corregido.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const accessToken = await getAccessToken(supabase);
    const shareUrl = process.env.ONEDRIVE_SHARE_URL;
    const sheetName = process.env.ONEDRIVE_SHEET_NAME || 'Agosto';
    const encodedShare = encodeShareUrl(shareUrl);

    const itemRes = await fetch(
      `https://graph.microsoft.com/v1.0/shares/${encodedShare}/driveItem`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!itemRes.ok) throw new Error('No se pudo resolver el archivo: ' + await itemRes.text());
    const driveItem = await itemRes.json();
    const driveId = driveItem.parentReference.driveId;
    const itemId = driveItem.id;

    const usedRangeUrl =
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}` +
      `/workbook/worksheets('${encodeURIComponent(sheetName)}')/usedRange(valuesOnly=true)`;
    const usedRes = await fetch(usedRangeUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!usedRes.ok) throw new Error('Error al leer rango: ' + await usedRes.text());
    const usedData = await usedRes.json();
    const rows = usedData.values || [];

    // Columnas (0-index): 0 Fecha, 1 Operador, 2 Modelo De RPA, 3 Turno,
    // 4 Tipificacion, 5 Tramo, 6 Ubicacion, 7 Cuadrante, ...
    const pendientes = [];
    rows.forEach((row, idx) => {
      if (idx === 0) return; // encabezado
      const tramo = String(row[5] ?? '').trim().toUpperCase();
      if (tramo !== 'NO') return;
      const cuadrante = String(row[7] ?? '').trim();
      if (cuadrante && cuadrante !== '—' && cuadrante !== '-') return; // ya tiene dato, no tocar
      const tipificacion = String(row[4] ?? '').trim();
      const valor = tipificacion === 'Servicio Farellones' ? 'FARELLONES' : '117';
      pendientes.push({ excelRow: idx + 1, valor });
    });

    let actualizadas = 0;
    const errores = [];
    for (const p of pendientes) {
      const rangeAddr = `H${p.excelRow}:H${p.excelRow}`;
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
        errores.push({ fila: p.excelRow, error: await writeRes.text() });
      }
    }

    return res.status(200).json({ ok: true, filasRevisadas: rows.length - 1, encontradas: pendientes.length, actualizadas, errores });
  } catch (e) {
    console.error('Fix cuadrantes error:', e);
    return res.status(500).json({ error: e.message });
  }
}
