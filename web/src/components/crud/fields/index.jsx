import { useState } from 'react';

// ─── Shared Styles ────────────────────────────────────────────────────────────

const fieldContainerStyle = {
  marginBottom: '16px',
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '14px',
  fontWeight: '500',
  color: '#333',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  borderRadius: '6px',
  border: '1px solid #ccc',
  boxSizing: 'border-box',
};

const inputErrorStyle = {
  ...inputStyle,
  borderColor: '#dc3545',
};

const errorTextStyle = {
  marginTop: '4px',
  fontSize: '12px',
  color: '#dc3545',
};

// ─── TextField ────────────────────────────────────────────────────────────────

export function TextField({ label, value, onChange, error, disabled }) {
  return (
    <div style={fieldContainerStyle}>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        style={error ? inputErrorStyle : inputStyle}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  );
}

// ─── TextareaField ────────────────────────────────────────────────────────────

export function TextareaField({ label, value, onChange, error, disabled }) {
  return (
    <div style={fieldContainerStyle}>
      <label style={labelStyle}>{label}</label>
      <textarea
        rows={3}
        style={error ? inputErrorStyle : inputStyle}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  );
}

// ─── ToggleField ──────────────────────────────────────────────────────────────

const toggleContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const toggleSwitchStyle = {
  position: 'relative',
  width: '44px',
  height: '24px',
  backgroundColor: '#ccc',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
};

const toggleSwitchActiveStyle = {
  ...toggleSwitchStyle,
  backgroundColor: '#1a73e8',
};

const toggleKnobStyle = {
  position: 'absolute',
  top: '2px',
  left: '2px',
  width: '20px',
  height: '20px',
  backgroundColor: '#fff',
  borderRadius: '50%',
  transition: 'left 0.2s',
  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
};

const toggleKnobActiveStyle = {
  ...toggleKnobStyle,
  left: '22px',
};

export function ToggleField({ label, value, onChange, error, disabled }) {
  const isOn = Boolean(value);

  const handleClick = () => {
    if (!disabled) {
      onChange(!isOn);
    }
  };

  return (
    <div style={fieldContainerStyle}>
      <div style={toggleContainerStyle}>
        <div
          style={isOn ? toggleSwitchActiveStyle : toggleSwitchStyle}
          onClick={handleClick}
          role="switch"
          aria-checked={isOn}
        >
          <div style={isOn ? toggleKnobActiveStyle : toggleKnobStyle} />
        </div>
        <span style={{ ...labelStyle, marginBottom: 0 }}>{label}</span>
      </div>
      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  );
}

// ─── SelectField ──────────────────────────────────────────────────────────────

export function SelectField({ label, value, onChange, error, disabled, options = [] }) {
  return (
    <div style={fieldContainerStyle}>
      <label style={labelStyle}>{label}</label>
      <select
        style={error ? inputErrorStyle : inputStyle}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  );
}

// ─── MultiselectField ─────────────────────────────────────────────────────────

const tagsContainerStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginBottom: '8px',
};

const tagStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  backgroundColor: '#e3f2fd',
  borderRadius: '16px',
  fontSize: '13px',
  color: '#1565c0',
};

const tagRemoveStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#1565c0',
  padding: 0,
  lineHeight: 1,
};

export function MultiselectField({ label, value, onChange, error, disabled, options = [] }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Parse comma-separated string to array
  const selectedValues = value
    ? value.split(',').map((v) => v.trim()).filter(Boolean)
    : [];

  // Get available options (not already selected)
  const availableOptions = options.filter((opt) => !selectedValues.includes(opt));

  const handleAdd = (opt) => {
    const newValues = [...selectedValues, opt];
    onChange(newValues.join(', '));
    setDropdownOpen(false);
  };

  const handleRemove = (opt) => {
    const newValues = selectedValues.filter((v) => v !== opt);
    onChange(newValues.join(', '));
  };

  return (
    <div style={fieldContainerStyle}>
      <label style={labelStyle}>{label}</label>
      {selectedValues.length > 0 && (
        <div style={tagsContainerStyle}>
          {selectedValues.map((val) => (
            <span key={val} style={tagStyle}>
              {val}
              {!disabled && (
                <button
                  type="button"
                  style={tagRemoveStyle}
                  onClick={() => handleRemove(val)}
                  aria-label={`Remove ${val}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && availableOptions.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            style={{
              ...inputStyle,
              textAlign: 'left',
              cursor: 'pointer',
              backgroundColor: '#fff',
            }}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            + Add {label.toLowerCase()}...
          </button>
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 10,
              }}
            >
              {availableOptions.map((opt) => (
                <div
                  key={opt}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #eee',
                  }}
                  onClick={() => handleAdd(opt)}
                  onMouseEnter={(e) => (e.target.style.backgroundColor = '#f5f5f5')}
                  onMouseLeave={(e) => (e.target.style.backgroundColor = '#fff')}
                >
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  );
}

// ─── DateField ────────────────────────────────────────────────────────────────

function formatDateForInput(value) {
  if (!value) return '';
  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  // Try to parse as Date and format
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through
  }
  return '';
}

export function DateField({ label, value, onChange, error, disabled }) {
  return (
    <div style={fieldContainerStyle}>
      <label style={labelStyle}>{label}</label>
      <input
        type="date"
        style={error ? inputErrorStyle : inputStyle}
        value={formatDateForInput(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  );
}

// ─── TimeField ────────────────────────────────────────────────────────────────

function formatTimeForInput(value) {
  if (!value) return '';
  // If already in HH:MM format, return as-is
  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  // Try to extract time from various formats
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = String(match[1]).padStart(2, '0');
    const minutes = match[2];
    return `${hours}:${minutes}`;
  }
  return '';
}

export function TimeField({ label, value, onChange, error, disabled }) {
  return (
    <div style={fieldContainerStyle}>
      <label style={labelStyle}>{label}</label>
      <input
        type="time"
        style={error ? inputErrorStyle : inputStyle}
        value={formatTimeForInput(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  );
}

// ─── Field Components Map ─────────────────────────────────────────────────────

export const FIELD_COMPONENTS = {
  text: TextField,
  textarea: TextareaField,
  toggle: ToggleField,
  select: SelectField,
  multiselect: MultiselectField,
  date: DateField,
  time: TimeField,
};
