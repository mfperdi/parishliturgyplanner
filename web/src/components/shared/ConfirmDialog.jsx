const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle = {
  backgroundColor: '#fff',
  borderRadius: '8px',
  padding: '24px',
  maxWidth: '400px',
  width: '90%',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
};

const titleStyle = {
  margin: '0 0 12px 0',
  fontSize: '18px',
  fontWeight: '600',
  color: '#333',
};

const messageStyle = {
  margin: '0 0 24px 0',
  fontSize: '14px',
  color: '#666',
  lineHeight: '1.5',
};

const buttonContainerStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
};

const buttonBaseStyle = {
  padding: '10px 20px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  border: 'none',
};

const confirmButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: '#dc3545',
  color: '#fff',
};

const cancelButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: '#6c757d',
  color: '#fff',
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={dialogStyle}>
        <h2 style={titleStyle}>{title}</h2>
        <p style={messageStyle}>{message}</p>
        <div style={buttonContainerStyle}>
          <button style={cancelButtonStyle} onClick={onCancel}>
            Cancel
          </button>
          <button style={confirmButtonStyle} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
