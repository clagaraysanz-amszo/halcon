// Vercel Cron — se ejecuta a las 10:00 UTC (07:00 Chile).
// Genera la bitácora nocturna del día operativo anterior.

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const now = new Date();
  const chile = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  chile.setDate(chile.getDate() - 1);
  const y = chile.getFullYear();
  const m = String(chile.getMonth() + 1).padStart(2, '0');
  const d = String(chile.getDate()).padStart(2, '0');
  const fecha = `${y}-${m}-${d}`;

  const baseUrl = `https://${req.headers.host}`;
  try {
    const response = await fetch(`${baseUrl}/api/bitacora/nocturna?fecha=${fecha}`, {
      method: 'POST',
    });
    const data = await response.json();

    if (!response.ok) {
      console.error('Cron bitácora error:', data);
      return res.status(500).json({ error: data.error, fecha });
    }

    return res.status(200).json({ ok: true, fecha, ...data });
  } catch (e) {
    console.error('Cron bitácora exception:', e);
    return res.status(500).json({ error: e.message, fecha });
  }
}
