import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { useRegistro } from '../context/RegistroContext';
import { useOperatorDay } from '../hooks/useOperatorDay';
import ScreenHeader from '../components/ScreenHeader';

export default function SeleccionTramo() {
  const { operador } = useAuth();
  const { tramos } = useCatalog();
  const { startRegistro } = useRegistro();
  const day = useOperatorDay(operador.halcon_n);
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | pend | done
  const [showMapNote, setShowMapNote] = useState(false);

  const pdoPendByTramoN = useMemo(() => {
    const m = new Map();
    day.pdoRows.filter((r) => r.estado === 'Pendiente').forEach((r) => m.set(r.tramo_n, r));
    return m;
  }, [day.pdoRows]);

  const doneTramoNs = useMemo(
    () => new Set(day.flights.filter((f) => f.estado === 'Realizado').map((f) => f.tramo_n)),
    [day.flights]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tramos.filter((t) => {
      const done = doneTramoNs.has(t.tramo_n);
      const inPdo = pdoPendByTramoN.has(t.tramo_n);
      if (filter === 'pend' && (done || !inPdo)) return false;
      if (filter === 'done' && !done) return false;
      if (!q) return true;
      return t.nombre.toLowerCase().includes(q) || String(t.tramo_n) === q || `tramo ${t.tramo_n}`.includes(q);
    });
  }, [tramos, query, filter, doneTramoNs, pdoPendByTramoN]);

  function seleccionar(tramo) {
    startRegistro(tramo, pdoPendByTramoN.get(tramo.tramo_n) ?? null);
    navigate('/registro');
  }

  return (
    <div className="screen">
      <ScreenHeader
        onBack={true}
        title="Selección del Tramo"
        subtitle={`Hoy: ${day.realizadosCount} realizados · ${day.pdoPend} del PDO pendientes`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.13)', borderRadius: 12, padding: '0 12px', height: 44, marginTop: 12 }}>
          <span style={{ opacity: 0.7 }}>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o número…"
            style={{ flex: 1, border: 'none', background: 'transparent', color: '#fff', fontSize: 14.5, outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto' }}>
          <button onClick={() => setFilter('all')} className={`chip--pill ${filter === 'all' ? 'chip--pill-on' : ''}`} style={{ cursor: 'pointer' }}>
            Todos ({tramos.length})
          </button>
          <button onClick={() => setFilter('pend')} className={`chip--pill ${filter === 'pend' ? 'chip--pill-on' : ''}`} style={{ cursor: 'pointer' }}>
            PDO pendientes ({day.pdoPend})
          </button>
          <button onClick={() => setFilter('done')} className={`chip--pill ${filter === 'done' ? 'chip--pill-on' : ''}`} style={{ cursor: 'pointer' }}>
            Realizados hoy ({day.realizadosCount})
          </button>
          <button
            onClick={() => setShowMapNote((v) => !v)}
            style={{ flex: 'none', border: '1px solid rgba(255,255,255,.25)', borderRadius: 20, padding: '8px 15px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#fff' }}
          >
            🗺 Mapa
          </button>
        </div>
      </ScreenHeader>

      {showMapNote && (
        <div style={{ margin: '12px 14px 0', background: 'var(--ambar-fondo)', border: '1px solid var(--ambar-borde)', borderRadius: 12, padding: '11px 14px', fontSize: 12.5, color: 'var(--ambar-texto)', fontWeight: 600 }}>
          🗺 Vista de mapa en desarrollo — disponible en la próxima versión.
        </div>
      )}

      <div className="content content--tight">
        {filtered.map((t) => {
          const done = doneTramoNs.has(t.tramo_n);
          const inPdo = pdoPendByTramoN.has(t.tramo_n);
          const hasBadge = done || inPdo;
          return (
            <button
              key={t.tramo_n}
              onClick={() => seleccionar(t)}
              className="list-item"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--borde-1)' }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  flex: 'none',
                  borderRadius: 13,
                  background: done ? '#EEF2F8' : '#FCEEE2',
                  color: done ? 'var(--texto-tenue)' : 'var(--naranjo)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.7, lineHeight: 1 }}>TRAMO</span>
                <span style={{ fontSize: 18, lineHeight: 1.05 }}>{t.tramo_n}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.nombre}
                </div>
                <div style={{ fontSize: 12, color: 'var(--texto-secundario)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>{t.sector}</span>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span style={{ fontWeight: 600 }}>Cuad. {t.cuadrante}</span>
                </div>
              </div>
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                {hasBadge && (
                  <span className={`badge ${done ? 'badge--done' : 'badge--pend'}`}>
                    {done ? 'Realizado hoy' : 'PDO · pendiente'}
                  </span>
                )}
                <span style={{ color: 'var(--texto-placeholder)', fontSize: 16 }}>›</span>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <div className="empty-state">Sin resultados para “{query}”.</div>}
      </div>
    </div>
  );
}
