import { createClient } from '@supabase/supabase-js';

export function encodeShareUrl(url) {
  const base64 = Buffer.from(url, 'utf-8').toString('base64');
  return 'u!' + base64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
}

export function getSupabase() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

export async function getAccessToken(supabase) {
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

/** Resuelve un link compartido de OneDrive/SharePoint a { driveId, itemId }. */
export async function resolveShareLink(shareUrl, accessToken) {
  const encodedShare = encodeShareUrl(shareUrl);
  const itemRes = await fetch(
    `https://graph.microsoft.com/v1.0/shares/${encodedShare}/driveItem`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!itemRes.ok) throw new Error('No se pudo resolver el archivo: ' + await itemRes.text());
  const driveItem = await itemRes.json();
  return {
    driveId: driveItem.parentReference.driveId,
    itemId: driveItem.id,
    parentId: driveItem.parentReference.id,
  };
}

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Nombre del mes actual en español, según la fecha real en Chile. */
export function nombreMesActual() {
  const now = new Date();
  const chile = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  return MESES_ES[chile.getMonth()];
}

/**
 * Devuelve el archivo Excel de la bitácora y la pestaña donde escribir hoy.
 * El archivo (ONEDRIVE_SHARE_URL) es siempre el mismo, para siempre — nunca
 * se crea ni se reemplaza. La pestaña se calcula por la fecha real (nunca
 * se guarda en ningún lado, así que no puede quedar desincronizada): cada
 * mes hay que crear a mano, con anticipación, una pestaña nueva con el
 * nombre del mes en español (ej. "Septiembre") en ese mismo archivo.
 */
export async function getArchivoActivo(supabase, accessToken) {
  const shareUrl = process.env.ONEDRIVE_SHARE_URL;
  const { driveId, itemId } = await resolveShareLink(shareUrl, accessToken);
  return { driveId, itemId, sheetName: nombreMesActual() };
}
