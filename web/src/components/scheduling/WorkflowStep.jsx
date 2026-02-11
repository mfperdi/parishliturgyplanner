const cardStyle = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '16px',
  backgroundColor: '#fff',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  alignItems: 'flex-start',
};

const badgeColors = {
  pending: { bg: '#e0e0e0', color: '#666' },
  active: { bg: '#1976d2', color: '#fff' },
  complete: { bg: '#2e7d32', color: '#fff' },
  error: { bg: '#c62828', color: '#fff' },
};

const badgeStyle = (status) => ({
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  fontWeight: '600',
  flexShrink: 0,
  backgroundColor: (badgeColors[status] || badgeColors.pending).bg,
  color: (badgeColors[status] || badgeColors.pending).color,
});

const contentStyle = {
  flex: 1,
  minWidth: 0,
};

const titleStyle = {
  margin: '0 0 4px 0',
  fontSize: '16px',
  fontWeight: '600',
  color: '#333',
};

const descriptionStyle = {
  margin: '0 0 12px 0',
  fontSize: '13px',
  color: '#777',
  lineHeight: '1.4',
};

const buttonStyle = {
  padding: '8px 18px',
  fontSize: '13px',
  fontWeight: '500',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  backgroundColor: '#1976d2',
  color: '#fff',
};

const disabledButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#bdbdbd',
  cursor: 'not-allowed',
};

const childrenStyle = {
  width: '100%',
  marginTop: '4px',
  paddingLeft: '52px',
};

export default function WorkflowStep({
  number,
  title,
  description,
  status,
  action,
  actionLabel,
  actionDisabled,
  children,
}) {
  return (
    <div style={cardStyle}>
      <div style={badgeStyle(status)}>
        {status === 'complete' ? '\u2713' : number}
      </div>
      <div style={contentStyle}>
        <h3 style={titleStyle}>{title}</h3>
        <p style={descriptionStyle}>{description}</p>
        {action && actionLabel && (
          <button
            style={actionDisabled ? disabledButtonStyle : buttonStyle}
            onClick={action}
            disabled={actionDisabled}
          >
            {actionLabel}
          </button>
        )}
      </div>
      {children && <div style={childrenStyle}>{children}</div>}
    </div>
  );
}
