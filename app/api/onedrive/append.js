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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const row = req.body;
    if (!row || !row.Fecha) return res.status(400).json({ error: 'Datos incompletos' });

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const accessToken = await getAccessToken(supabase);
    const shareUrl = process.env.ONEDRIVE_SHARE_URL;
    const sheetName = process.env.ONEDRIVE_SHEET_NAME || 'Agosto';
    const encodedShare = encodeShareUrl(shareUrl);

    // Resolver el link compartido a un driveItem
    const itemRes = await fetch(
      `https://graph.microsoft.com/v1.0/shares/${encodedShare}/driveItem`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!itemRes.ok) {
      const errText = await itemRes.text();
      throw new Error('No se pudo resolver el archivo: ' + errText);
    }

    const driveItem = await itemRes.json();
    const driveId = driveItem.parentReference.driveId;
    const itemId = driveItem.id;

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
