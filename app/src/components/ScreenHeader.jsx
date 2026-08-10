import { useNavigate } from 'react-router-dom';

export default function ScreenHeader({ title, subtitle, onBack, variant = 'plain', children }) {
  const navigate = useNavigate();
  const cls = ['header', variant === 'gradient' && 'header--gradient', variant === 'dark' && 'header--dark', variant === 'supervisor' && 'header--supervisor']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      <div className="header-row">
        {onBack && (
          <button className="back-btn" onClick={() => (onBack === true ? navigate(-1) : onBack())} aria-label="Volver">
            ‹
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="header-title">{title}</div>
          {subtitle && <div className="header-subtitle">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}
