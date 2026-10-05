import { X } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Right-anchored slide-in drawer rendered as a fixed overlay (never in page flow).
 * The page behind it (e.g. the map) stays in place; no dimming backdrop.
 *
 * Props: open, onClose, title, children, footer (sticky footer node),
 *        top (offset below the global header, default 64px), width (default 420px)
 */
export function Drawer({ open, isOpen, onClose, title, children, footer, top = 64, width = 420 }) {
  const visible = open !== undefined ? open : (isOpen !== undefined ? isOpen : false);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    if (visible) window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-label={title}
      style={{
        position: 'fixed',
        top,
        right: 0,
        height: `calc(100vh - ${top}px)`,
        width: `min(${width}px, 100vw)`,
        zIndex: 50,
        background: '#FFFFFF',
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
        borderLeft: '1px solid #E8DCC8',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          padding: '16px 56px 16px 20px',
          borderBottom: '1px solid #EDE4D3',
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1A1410' }}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F4F6')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          style={{
            position: 'absolute',
            top: '12px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            color: '#1A1410',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>{children}</div>

      {footer && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: '#FFFFFF',
            borderTop: '1px solid #E5DCD0',
            padding: '12px 16px',
            display: 'flex',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}
