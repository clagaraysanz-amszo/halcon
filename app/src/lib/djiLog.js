const API_URL = import.meta.env.PROD ? '/api/dji/parse' : '/api/dji/parse';

export async function parseDjiLog(file) {
  const buffer = await file.arrayBuffer();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de red' }));
    throw new Error(err.error || `Error ${res.status}`);
  }

  return res.json();
}
