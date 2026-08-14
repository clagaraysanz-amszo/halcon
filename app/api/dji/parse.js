import { DJILog } from 'dji-log-parser-js';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const PRODUCT_TO_AERONAVE = {
  Mavic2: 'DUAL',
  Mavic2Enterprise: 'DUAL',
  Mavic3: '3TD',
  Mavic3Enterprise: '3TD',
  Mavic3Pro: '3TD',
  Matrice300RTK: 'MATRICE 300',
  Matrice350RTK: 'MATRICE 300',
  MavicAir2: 'AIR 2',
  MavicAir2S: 'AIR 2',
};

const ALTURA_OPTIONS = [60, 70, 80, 90, 100, 110, 120, 200, 300, 400, 500, 600];
const DISTANCIA_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

function closest(arr, val) {
  return arr.reduce((prev, curr) => Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev);
}

async function matchAeronaveBySn(sn) {
  if (!sn) return null;
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const { data } = await supabase
    .from('drones')
    .select('codigo, modelo')
    .eq('numero_serie', sn.trim())
    .maybeSingle();

  if (!data) return null;

  const code = data.codigo;
  if (code === 'M2EA') return 'ADVANCED';
  if (code.startsWith('M2EZ')) return 'ZOOM';
  if (code === 'M2E') return 'DUAL';
  if (code === 'M3ET' || code.startsWith('3TD')) return '3TD';
  if (code === 'M300') return 'MATRICE 300';
  if (code === 'AUTEL') return 'AUTEL';
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (buffer.length < 100) {
      return res.status(400).json({ error: 'Archivo demasiado pequeño para ser un log DJI' });
    }

    const bytes = new Uint8Array(buffer);
    const parser = new DJILog(bytes);
    const details = parser.details;
    const version = parser.version;

    const startTime = details.startTime;
    const totalTimeSec = details.totalTime;
    const totalDistanceM = details.totalDistance;
    const maxHeightM = details.maxHeight;
    const lat = details.latitude;
    const lng = details.longitude;
    const productType = details.productType;
    const aircraftSn = details.aircraftSn;
    const aircraftName = details.aircraftName;

    const minutos = Math.max(1, Math.round(totalTimeSec / 60));

    let horaInicio = '';
    if (startTime) {
      const d = new Date(startTime);
      if (!isNaN(d.getTime())) {
        horaInicio = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    }

    const alturaNum = closest(ALTURA_OPTIONS, Math.round(maxHeightM));
    const altura = `${alturaNum} metros`;

    const distanciaNum = closest(DISTANCIA_OPTIONS, Math.round(totalDistanceM));
    const distancia = `${distanciaNum} metros`;

    let aeronave = null;
    const snMatch = await matchAeronaveBySn(aircraftSn);
    if (snMatch) {
      aeronave = snMatch;
    } else {
      const typeStr = typeof productType === 'string' ? productType : (productType?.Unknown ? null : Object.keys(productType || {})[0]);
      if (typeStr && PRODUCT_TO_AERONAVE[typeStr]) {
        aeronave = PRODUCT_TO_AERONAVE[typeStr];
      }
    }

    let batteryStart = null;
    let batteryEnd = null;
    let gpsTrackPoints = 0;
    if (version < 13) {
      try {
        const frames = parser.frames();
        if (frames.length > 0) {
          batteryStart = frames[0].battery?.chargeLevel ?? null;
          batteryEnd = frames[frames.length - 1].battery?.chargeLevel ?? null;
          gpsTrackPoints = frames.filter(f => f.osd && f.osd.latitude !== 0).length;
        }
      } catch (_) { /* frames not available */ }
    }

    return res.status(200).json({
      ok: true,
      version,
      horaInicio,
      minutos,
      altura,
      distancia,
      aeronave,
      latitud: lat && lat !== 0 ? lat : null,
      longitud: lng && lng !== 0 ? lng : null,
      maxHeight: Math.round(maxHeightM * 10) / 10,
      totalDistance: Math.round(totalDistanceM),
      totalTimeSec,
      productType: typeof productType === 'string' ? productType : JSON.stringify(productType),
      aircraftSn: aircraftSn?.trim() || null,
      aircraftName: aircraftName?.trim() || null,
      batteryStart,
      batteryEnd,
      gpsTrackPoints,
      encrypted: version >= 13,
    });
  } catch (err) {
    console.error('DJI parse error:', err);
    return res.status(400).json({
      error: 'No se pudo leer el archivo. Asegúrate de que sea un log de DJI Fly (.txt)',
      detail: err.message,
    });
  }
}
