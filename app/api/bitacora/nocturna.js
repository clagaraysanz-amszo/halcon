import { createClient } from '@supabase/supabase-js';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel,
  TableLayoutType,
} from 'docx';

const SHARE_FOLDER_URL =
  'https://amszo-my.sharepoint.com/:f:/g/personal/drones_amszo_cl/IgDzgp8HB3JUSra8hsbJ90o0Af07Ga4ViSrzhah2p65HTDA?e=7DJjPo';

const AERONAVE_MAP = {
  'DUAL':        'M2EA',
  'ADVANCED':    'M2EA',
  'ZOOM':        'M2EZ-1',
  '3TD':         '3TD-1',
  'MATRICE 300': 'M300',
  'AUTEL':       'AUTEL',
  'AIR 2':       null,
};

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
    await supabase.from('app_config').upsert(
      { key: 'onedrive_refresh_token', value: tokens.refresh_token },
      { onConflict: 'key' }
    );
  }

  return tokens.access_token;
}

function horaFin(horaInicio, minutos) {
  const [hh, mm] = horaInicio.split(':').map(Number);
  const totalMin = hh * 60 + mm + minutos;
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatFechaDDMMYYYY(fechaStr) {
  const [y, m, d] = fechaStr.split('-');
  return `${d}/${m}/${y}`;
}

function thinBorders() {
  const side = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
  return { top: side, bottom: side, left: side, right: side };
}

function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: thinBorders(),
    shading: { fill: '16233F' },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text, bold: true, size: 16, color: 'FFFFFF', font: 'Calibri' })],
      }),
    ],
  });
}

function dataCell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: thinBorders(),
    children: [
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 30, after: 30 },
        children: [
          new TextRun({
            text: text || '—',
            size: opts.size || 16,
            font: 'Calibri',
            bold: opts.bold || false,
          }),
        ],
      }),
    ],
  });
}

function buildDocx(fecha, flights, drones, operadores, tramos) {
  const fechaFmt = formatFechaDDMMYYYY(fecha);
  const totalMin = flights.reduce((s, f) => s + (f.minutos || 0), 0);
  const horas = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  const droneMap = new Map(drones.map((d) => [d.codigo, d]));
  const opMap = new Map(operadores.map((o) => [o.halcon_n, o]));
  const tramoMap = new Map(tramos.map((t) => [t.tramo_n, t]));

  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'BITÁCORA DE VUELO NOCTURNO',
          bold: true, size: 28, font: 'Calibri', color: '16233F',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'Operaciones de Aeronaves Pilotadas a Distancia (RPAS)',
          size: 18, font: 'Calibri', color: '555555',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'Conforme DAN 151 — DGAC Chile',
          size: 16, font: 'Calibri', color: '555555', italics: true,
        }),
      ],
    })
  );

  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          headerCell('Operador', 25),
          dataCell('Asoc. Munic. Seguridad Zona Oriente (AMSZO)', 75),
        ],
      }),
      new TableRow({
        children: [
          headerCell('RUT', 25),
          dataCell('65.118.035-K', 75),
        ],
      }),
      new TableRow({
        children: [
          headerCell('Fecha operativa', 25),
          dataCell(fechaFmt, 75),
        ],
      }),
      new TableRow({
        children: [
          headerCell('Período', 25),
          dataCell('Desde fin de atardecer hasta antes del amanecer (Turno Nocturno)', 75),
        ],
      }),
      new TableRow({
        children: [
          headerCell('Total vuelos', 25),
          dataCell(`${flights.length} vuelos — ${horas}h ${mins}min de vuelo total`, 75),
        ],
      }),
    ],
  });

  children.push(
    new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),
    infoTable
  );

  if (flights.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 300 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'Sin vuelos nocturnos registrados para esta fecha.',
            size: 20, font: 'Calibri', color: '888888', italics: true,
          }),
        ],
      })
    );
  } else {
    children.push(
      new Paragraph({
        spacing: { before: 300, after: 100 },
        children: [
          new TextRun({
            text: 'DETALLE DE VUELOS',
            bold: true, size: 22, font: 'Calibri', color: '16233F',
          }),
        ],
      })
    );

    const vueloHeaderRow = new TableRow({
      children: [
        headerCell('N°', 5),
        headerCell('Hora', 10),
        headerCell('Operador', 12),
        headerCell('RPA', 18),
        headerCell('Matrícula', 9),
        headerCell('Ubicación', 16),
        headerCell('Altura', 8),
        headerCell('Duración', 8),
        headerCell('Tipificación', 14),
      ],
    });

    const vueloRows = flights.map((f, i) => {
      const aeroCode = AERONAVE_MAP[f.aeronave] || f.aeronave;
      const drone = droneMap.get(aeroCode);
      const op = opMap.get(f.halcon_n);
      const tramo = f.tramo_n ? tramoMap.get(f.tramo_n) : null;
      const ubicacion = f.ubicacion_manual || tramo?.nombre || '—';
      const hFin = f.hora_inicio ? horaFin(f.hora_inicio, f.minutos || 0) : '—';
      const horaRango = f.hora_inicio ? `${f.hora_inicio}–${hFin}` : '—';

      return new TableRow({
        children: [
          dataCell(String(i + 1), 5, { center: true, bold: true }),
          dataCell(horaRango, 10, { center: true }),
          dataCell(op ? `Halcón ${f.halcon_n}\n${op.nombre}` : `Halcón ${f.halcon_n}`, 12),
          dataCell(drone ? `${drone.marca} ${drone.modelo}\nS/N: ${drone.numero_serie}` : f.aeronave, 18),
          dataCell(drone?.matricula_dgac || '—', 9, { center: true }),
          dataCell(ubicacion, 16),
          dataCell(f.altura || '—', 8, { center: true }),
          dataCell(`${f.minutos} min`, 8, { center: true }),
          dataCell(f.tipificacion || '—', 14),
        ],
      });
    });

    const vueloTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [vueloHeaderRow, ...vueloRows],
    });

    children.push(vueloTable);

    const dronesUsados = new Set();
    flights.forEach((f) => {
      const code = AERONAVE_MAP[f.aeronave] || f.aeronave;
      if (code) dronesUsados.add(code);
    });

    const dronesDetalle = drones.filter((d) => dronesUsados.has(d.codigo));
    if (dronesDetalle.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 300, after: 100 },
          children: [
            new TextRun({
              text: 'EQUIPOS UTILIZADOS',
              bold: true, size: 22, font: 'Calibri', color: '16233F',
            }),
          ],
        })
      );

      const eqHeaderRow = new TableRow({
        children: [
          headerCell('Marca', 12),
          headerCell('Modelo', 22),
          headerCell('N° de serie', 22),
          headerCell('Matrícula DGAC', 14),
          headerCell('Peso máx (kg)', 10),
          headerCell('Autonomía', 10),
          headerCell('Paracaídas', 10),
        ],
      });

      const eqRows = dronesDetalle.map(
        (d) =>
          new TableRow({
            children: [
              dataCell(d.marca, 12),
              dataCell(d.modelo, 22),
              dataCell(d.numero_serie, 22, { size: 14 }),
              dataCell(d.matricula_dgac || 'Pendiente', 14, { center: true }),
              dataCell(String(d.peso_max_kg), 10, { center: true }),
              dataCell(`${d.autonomia_min} min`, 10, { center: true }),
              dataCell(d.paracaidas || '—', 10, { center: true }),
            ],
          })
      );

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [eqHeaderRow, ...eqRows],
        })
      );
    }

    const observaciones = flights
      .filter((f) => f.observaciones)
      .map((f, i) => {
        const op = opMap.get(f.halcon_n);
        return `• Halcón ${f.halcon_n} (${f.hora_inicio || '—'}): ${f.observaciones}`;
      });

    if (observaciones.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 300, after: 80 },
          children: [
            new TextRun({
              text: 'OBSERVACIONES',
              bold: true, size: 22, font: 'Calibri', color: '16233F',
            }),
          ],
        })
      );
      observaciones.forEach((obs) => {
        children.push(
          new Paragraph({
            spacing: { before: 20, after: 20 },
            children: [new TextRun({ text: obs, size: 18, font: 'Calibri' })],
          })
        );
      });
    }
  }

  children.push(
    new Paragraph({
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: 'Documento generado automáticamente por Sistema HALCÓN — AMSZO',
          size: 14, font: 'Calibri', color: 'AAAAAA', italics: true,
        }),
      ],
    })
  );

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
          size: { orientation: 'landscape' },
        },
      },
      children,
    }],
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'POST o GET' });
  }

  try {
    const fecha = req.query.fecha || req.body?.fecha;
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: 'Falta parámetro fecha (YYYY-MM-DD)' });
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Vuelos nocturnos: turno N explícito, O hora_inicio >= 19:00, O hora_inicio < 07:00
    const [flightsRes, dronesRes, operadoresRes, tramosRes] = await Promise.all([
      supabase
        .from('registro_vuelos')
        .select('*')
        .eq('fecha', fecha)
        .order('hora_inicio', { ascending: true }),
      supabase.from('drones').select('*').eq('activo', true),
      supabase.from('operadores').select('*'),
      supabase.from('tramos').select('*'),
    ]);

    if (flightsRes.error) throw flightsRes.error;
    if (dronesRes.error) throw dronesRes.error;

    const allFlights = flightsRes.data || [];
    const flights = allFlights.filter((f) => {
      if (f.turno_manual === 'N') return true;
      if (!f.hora_inicio) return false;
      const [hh] = f.hora_inicio.split(':').map(Number);
      return hh >= 19 || hh < 7;
    });
    const drones = dronesRes.data || [];
    const operadores = operadoresRes.data || [];
    const tramos = tramosRes.data || [];

    const doc = buildDocx(fecha, flights, drones, operadores, tramos);
    const buffer = await Packer.toBuffer(doc);

    const [, mm, dd] = fecha.split('-');
    const filename = `Bitacora_Nocturna_${dd}-${mm}-${fecha.slice(0, 4)}.docx`;

    const onlyDownload = req.query.download === '1' || req.body?.download;
    if (onlyDownload) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(buffer);
    }

    const accessToken = await getAccessToken(supabase);
    const encodedShare = encodeShareUrl(SHARE_FOLDER_URL);

    const folderRes = await fetch(
      `https://graph.microsoft.com/v1.0/shares/${encodedShare}/driveItem`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!folderRes.ok) {
      const errText = await folderRes.text();
      throw new Error('No se pudo resolver la carpeta SharePoint: ' + errText);
    }

    const folder = await folderRes.json();
    const driveId = folder.parentReference.driveId;
    const folderId = folder.id;

    const uploadUrl =
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${filename}:/content`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error('Error al subir archivo: ' + errText);
    }

    const uploaded = await uploadRes.json();

    return res.status(200).json({
      ok: true,
      filename,
      vuelos: flights.length,
      webUrl: uploaded.webUrl || null,
    });
  } catch (e) {
    console.error('Bitácora nocturna error:', e);
    return res.status(500).json({ error: e.message });
  }
}
