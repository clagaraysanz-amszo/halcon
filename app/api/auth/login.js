export default function handler(req, res) {
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const tenantId = process.env.ONEDRIVE_TENANT_ID;
  const redirectUri = 'https://halcon-iota.vercel.app/api/auth/callback';
  const scope = 'offline_access Files.ReadWrite';

  const authUrl =
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_mode=query`;

  res.redirect(302, authUrl);
}
