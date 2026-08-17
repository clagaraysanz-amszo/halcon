import { getSupabase, getAccessToken, resolveShareLink } from '../_lib/onedrive.js';

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Copia el archivo plantilla (ONEDRIVE_TEMPLATE_SHARE_URL) a un archivo
 * nuevo en la misma carpeta, con el nombre dado. La copia en Graph API es
 * asíncrona (202 + Location de monitoreo): se hace polling hasta que
 * termine y se devuelve el id del archivo nuevo.
 */
async function copiarPlantilla({ driveId, itemId, parentId }, nombreArchivo, accessToken) {
  const copyRes = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/copy`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentReference: { driveId, id: parentId },
        name: nombreArchivo,
      }),
    }
  );

  if (copyRes.status !== 202) {
    throw new Error('Copia falló: ' + copyRes.status + ' ' + await copyRes.text());
  }

  const monitorUrl = copyRes.headers.get('Location');
  if (!monitorUrl) throw new Error('Graph no devolvió URL de monitoreo para la copia');

  for (let intento = 0; intento < 15; intento++) {
    await sleep(2000);
    const statusRes = await fetch(monitorUrl);
    const statusData = await statusRes.json();
    if (statusData.status === 'completed' && statusData.resourceId) {
      return statusData.resourceId;
    }
    if (statusData.status === 'failed') {
      throw new Error('Copia falló durante el proceso: ' + JSON.stringify(statusData));
    }
  }
  throw new Error('La copia del archivo no terminó a tiempo (timeout de polling)');
}

/**
 * Cron mensual (día 1 de cada mes): copia el Excel plantilla en blanco a un
 * archivo nuevo con el nombre del mes/año, y actualiza app_config para que
 * append.js / fix-cuadrantes.js empiecen a escribir ahí. Idempotente por
 * mes: si ya corrió para el mes actual, no hace nada.
 */
export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const supabase = getSupabase();

    const now = new Date();
    const chile = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
    const mesIdx = chile.getMonth();
    const anio = chile.getFullYear();
    const mesKey = `${anio}-${String(mesIdx + 1).padStart(2, '0')}`;
    const mesNombre = MESES_ES[mesIdx];

    const { data: yaCorrioRow } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'onedrive_current_month')
      .maybeSingle();

    if (yaCorrioRow?.value === mesKey && !req.query?.forzar) {
      return res.status(200).json({ ok: true, skip: true, mensaje: `Ya se creó la bitácora de ${mesNombre} ${anio}.` });
    }

    const accessToken = await getAccessToken(supabase);

    const templateShareUrl = process.env.ONEDRIVE_TEMPLATE_SHARE_URL;
    if (!templateShareUrl) throw new Error('Falta la variable de entorno ONEDRIVE_TEMPLATE_SHARE_URL');
    const template = await resolveShareLink(templateShareUrl, accessToken);
    console.log('[monthly-rollover] plantilla resuelta:', JSON.stringify(template));

    const nombreArchivo = `Bitácora Halcón - ${mesNombre} ${anio}.xlsx`;
    const nuevoItemId = await copiarPlantilla(template, nombreArchivo, accessToken);
    console.log('[monthly-rollover] copia creada, nuevoItemId:', nuevoItemId);

    // Confirma el nombre REAL que quedó en OneDrive (por si Graph lo cambió,
    // p.ej. por conflicto con un archivo existente del mismo nombre).
    const nuevoItemRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${template.driveId}/items/${nuevoItemId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const nuevoItemData = await nuevoItemRes.json();
    const nombreReal = nuevoItemData.name || nombreArchivo;
    console.log('[monthly-rollover] nombre real en OneDrive:', nombreReal, '| pedido:', nombreArchivo);

    // Detecta el nombre real de la primera hoja del archivo nuevo (en vez de
    // asumirlo), por si la plantilla usa un nombre de hoja distinto.
    const sheetsRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${template.driveId}/items/${nuevoItemId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!sheetsRes.ok) throw new Error('No se pudo leer las hojas del archivo nuevo: ' + await sheetsRes.text());
    const sheetsData = await sheetsRes.json();
    const sheetName = sheetsData.value?.[0]?.name || 'Hoja1';
    console.log('[monthly-rollover] hoja detectada:', sheetName);

    await supabase.from('app_config').upsert([
      { key: 'onedrive_drive_id', value: template.driveId },
      { key: 'onedrive_item_id', value: nuevoItemId },
      { key: 'onedrive_sheet_name', value: sheetName },
      { key: 'onedrive_current_month', value: mesKey },
    ], { onConflict: 'key' });

    const resultado = {
      ok: true,
      mes: `${mesNombre} ${anio}`,
      archivoPedido: nombreArchivo,
      archivoReal: nombreReal,
      driveId: template.driveId,
      itemId: nuevoItemId,
      sheetName,
    };
    console.log('[monthly-rollover] resultado final:', JSON.stringify(resultado));
    return res.status(200).json(resultado);
  } catch (e) {
    console.error('Monthly rollover error:', e);
    return res.status(500).json({ error: e.message });
  }
}
