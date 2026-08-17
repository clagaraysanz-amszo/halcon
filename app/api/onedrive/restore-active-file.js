import { getSupabase, getAccessToken, resolveShareLink } from '../_lib/onedrive.js';

/**
 * Endpoint de emergencia: revierte app_config para que vuelva a apuntar al
 * archivo Excel original (ONEDRIVE_SHARE_URL), deshaciendo un rollover
 * mensual disparado por error (p.ej. una prueba manual del cron que, al
 * correr dentro del mes en curso, redirige el registro de vuelos a un
 * archivo nuevo y vacío en vez del histórico real).
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

    const shareUrl = process.env.ONEDRIVE_SHARE_URL;
    if (!shareUrl) throw new Error('Falta ONEDRIVE_SHARE_URL');
    const { driveId, itemId } = await resolveShareLink(shareUrl, accessToken);

    const sheetName = process.env.ONEDRIVE_SHEET_NAME || 'Agosto';

    // Confirma que la hoja existe en ese archivo antes de guardar.
    const sheetsRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!sheetsRes.ok) throw new Error('No se pudo leer las hojas: ' + await sheetsRes.text());
    const sheetsData = await sheetsRes.json();
    const nombres = (sheetsData.value || []).map((s) => s.name);
    if (!nombres.includes(sheetName)) {
      throw new Error(`La hoja "${sheetName}" no existe en el archivo original. Hojas disponibles: ${nombres.join(', ')}`);
    }

    await supabase.from('app_config').upsert([
      { key: 'onedrive_drive_id', value: driveId },
      { key: 'onedrive_item_id', value: itemId },
      { key: 'onedrive_sheet_name', value: sheetName },
    ], { onConflict: 'key' });

    const resultado = { ok: true, restaurado: { driveId, itemId, sheetName } };
    console.log('[restore-active-file] restaurado:', JSON.stringify(resultado));
    return res.status(200).json(resultado);
  } catch (e) {
    console.error('Restore active file error:', e);
    return res.status(500).json({ error: e.message });
  }
}
