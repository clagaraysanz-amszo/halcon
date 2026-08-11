import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOperatorDay } from '../hooks/useOperatorDay';
import { TURNOS, formatFechaCorta } from '../lib/turnos';
import logo from '../assets/logo.png';

export default function Home() {
  const { operador, signOut } = useAuth();
  const navigate = useNavigate();
  const day = useOperatorDay(operador.halcon_n);
  const turnoInfo = day.turno ? TURNOS[day.turno] : null;
  const nextPend = day.pdoRows.find((r) => r.estado === 'Pendiente');

  return (
    <div className="screen">
      <div className="header header--gradient">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 2px rgba(238,107,30,.35)',
              }}
            >
              <img src={logo} style={{ width: 38, height: 38, objectFit: 'cover', objectPosition: 'left center', borderRadius: '50%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#EE6B1E', fontWeight: 700, letterSpacing: 1.5 }}>
                HALCÓN {operador.halcon_n}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.15 }}>{operador.nombre}</div>
            </div>
          </div>
          <div
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: '#3FD07A',
              boxShadow: '0 0 0 4px rgba(63,208,122,.2)',
            }}
          />
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <div className="header-stat-label">Fecha</div>
            <div className="header-stat-value" style={{ fontSize: 15 }}>
              {formatFechaCorta(new Date())}
            </div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">
              {turnoInfo ? `Turno ${day.turno} · ${turnoInfo.label}` : 'Sin turno hoy'}
            </div>
            <div className="header-stat-value" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className="status-dot"
                style={{ background: turnoInfo ? turnoInfo.dotColor : '#B8C0CC' }}
              />
              {turnoInfo ? turnoInfo.horas : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="kpi-row">
          <div className="kpi-card">
            <div className="kpi-value">{day.loading ? '—' : day.vuelosHoy}</div>
            <div className="kpi-label">Vuelos hoy</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value kpi-value--accent">{day.loading ? '—' : day.realizadosCount}</div>
            <div className="kpi-label">Tramos realizados hoy</div>
          </div>
        </div>

        {!day.loading && day.diaLibre && (
          <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 13 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                background: '#EEF2F8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              🌤
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--texto-titulo)' }}>Día libre</div>
              <div style={{ fontSize: 12.5, color: 'var(--texto-secundario)', marginTop: 2 }}>
                No figuras en el PDO de hoy. Sin vuelos asignados.
              </div>
            </div>
          </div>
        )}

        {!day.loading && !day.diaLibre && (
          <button
            onClick={() => navigate('/mis-vuelos')}
            style={{
              width: '100%',
              border: '1.5px solid #CFE0F0',
              borderRadius: 18,
              background: 'linear-gradient(135deg,#F4F8FC,#EAF1FA)',
              padding: '16px 18px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  background: 'var(--azul)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                📋
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--texto-titulo)' }}>
                  PDO del día · Turno {day.turno}
                </div>
                <div style={{ fontSize: 12, color: 'var(--texto-secundario)', marginTop: 1 }}>
                  {day.pdoDone}/{day.pdoRows.length} sobrevuelos realizados
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#fff',
                  background: '#EE6B1E',
                  padding: '5px 10px',
                  borderRadius: 20,
                }}
              >
                {day.pdoPend} pend.
              </span>
            </div>
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: '#fff',
                border: '1px solid #DDE6F0',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--texto-titulo)',
                  background: '#EEF2F8',
                  padding: '5px 9px',
                  borderRadius: 8,
                }}
              >
                {nextPend ? nextPend.hora : '—'}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  color: 'var(--texto-titulo)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {nextPend ? `Próximo: Tramo ${nextPend.tramo_n}` : 'Todos los sobrevuelos completados'}
              </span>
              <span style={{ color: '#2C6FB5', fontSize: 16 }}>›</span>
            </div>
          </button>
        )}

        <button
          onClick={() => navigate('/tramos')}
          className="btn btn-primary"
          style={{ padding: 22, height: 'auto', justifyContent: 'flex-start', gap: 16, textAlign: 'left' }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              flex: 'none',
              borderRadius: 15,
              background: 'rgba(255,255,255,.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
            }}
          >
            ◎
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 700 }}>Realizar Tramo</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>Iniciar registro de vuelo</div>
          </div>
          <span style={{ fontSize: 22 }}>→</span>
        </button>

        <button
          onClick={() => navigate('/otros-vuelos')}
          className="btn btn-outline"
          style={{ padding: 22, height: 'auto', justifyContent: 'flex-start', gap: 16, textAlign: 'left', borderColor: '#7C3AED' }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              flex: 'none',
              borderRadius: 15,
              background: '#F3F0FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
            }}
          >
            📝
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--texto-titulo)' }}>Otros Vuelos</div>
            <div style={{ fontSize: 13, color: 'var(--texto-secundario)', marginTop: 2 }}>Vuelos operativos sin tramo</div>
          </div>
          <span style={{ fontSize: 22, color: '#7C3AED' }}>→</span>
        </button>

        <button
          onClick={() => navigate('/historial')}
          className="btn-outline btn"
          style={{ padding: 16, height: 'auto', justifyContent: 'flex-start', gap: 13, textAlign: 'left' }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#EEF2F8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            🕑
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--texto-titulo)' }}>Historial del Día</div>
            <div style={{ fontSize: 12.5, color: 'var(--texto-secundario)', marginTop: 1 }}>
              Tus vuelos registrados hoy
            </div>
          </div>
          <span style={{ color: '#B8C0CC', fontSize: 18 }}>›</span>
        </button>

        <button onClick={signOut} className="btn-danger-ghost btn" style={{ marginTop: 4 }}>
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
