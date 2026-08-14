import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { code, error: authError } = req.query;

  if (authError || !code) {
    return res.status(400).send('Error de autenticación: ' + (authError || 'sin código'));
  }

  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
  const tenantId = process.env.ONEDRIVE_TENANT_ID;
  const redirectUri = 'https://halcon-iota.vercel.app/api/auth/callback';

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'offline_access Files.ReadWrite',
      }),
    }
  );

  const tokens = await tokenRes.json();

  if (!tokens.refresh_token) {
    return res.status(400).send('No se obtuvo refresh_token: ' + JSON.stringify(tokens));
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  await supabase.from('app_config').upsert({
    key: 'onedrive_refresh_token',
    value: tokens.refresh_token,
  }, { onConflict: 'key' });

  await supabase.from('app_config').upsert({
    key: 'onedrive_access_token',
    value: tokens.access_token,
  }, { onConflict: 'key' });

  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:60px">
      <h2>✓ OneDrive conectado</h2>
      <p>La bitácora se actualizará automáticamente.</p>
      <p>Puedes cerrar esta pestaña.</p>
    </body></html>
  `);
}
