import { useEffect } from 'react';

const baseStyle = {
  padding: '12px 16px',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
  fontSize: '14px',
};

const loadingStyle = {
  ...baseStyle,
  backgroundColor: '#e3f2fd',
  color: '#1565c0',
  border: '1px solid #90caf9',
};

const successStyle = {
  ...baseStyle,
  backgroundColor: '#e8f5e9',
  color: '#2e7d32',
  border: '1px solid #a5d6a7',
};

const errorStyle = {
  ...baseStyle,
  backgroundColor: '#ffebee',
  color: '#c62828',
  border: '1px solid #ef9a9a',
};

const dismissButtonStyle = {
  background: 'none',
  border: 'none',
  fontSize: '18px',
  cursor: 'pointer',
  padding: '0 4px',
  marginLeft: '12px',
  opacity: 0.7,
};

const spinnerStyle = {
  display: 'inline-block',
  width: '14px',
  height: '14px',
  border: '2px solid #90caf9',
  borderTopColor: '#1565c0',
  borderRadius: '50%',
  marginRight: '10px',
  animation: 'spin 1s linear infinite',
};

export default function StatusMessage({ status, message, onDismiss }) {
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        onDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, onDismiss]);

  if (status === 'idle') {
    return null;
  }

  if (status === 'loading') {
    return (
      <div style={loadingStyle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <style>
            {`@keyframes spin { to { transform: rotate(360deg); } }`}
          </style>
          <span style={spinnerStyle}></span>
          <span>Working...</span>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={successStyle}>
        <span>{message}</span>
        <button
          style={{ ...dismissButtonStyle, color: '#2e7d32' }}
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={errorStyle}>
        <span>{message}</span>
        <button
          style={{ ...dismissButtonStyle, color: '#c62828' }}
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>
    );
  }

  return null;
}
