import { useState, useMemo } from 'react';

const containerStyle = {
  maxWidth: '600px',
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '10px 0',
  borderBottom: '1px solid #eee',
};

const labelStyle = {
  flex: '0 0 200px',
  fontWeight: '600',
  fontSize: '14px',
  color: '#333',
};

const inputStyle = {
  flex: 1,
  padding: '8px 12px',
  fontSize: '14px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  outline: 'none',
};

const inputChangedStyle = {
  ...inputStyle,
  borderColor: '#1a73e8',
  backgroundColor: '#f0f7ff',
};

const buttonStyle = {
  padding: '10px 24px',
  fontSize: '14px',
  fontWeight: '500',
  backgroundColor: '#1a73e8',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  marginTop: '20px',
};

const buttonDisabledStyle = {
  ...buttonStyle,
  backgroundColor: '#ccc',
  cursor: 'not-allowed',
};

export default function SettingsForm({ columns, rows, onSave }) {
  // Local state tracks edited values — keyed by row index
  const [values, setValues] = useState(() => {
    const initial = {};
    rows.forEach((row, i) => {
      initial[i] = row[1] !== undefined && row[1] !== null ? String(row[1]) : '';
    });
    return initial;
  });

  // Track which rows have changed
  const changedRows = useMemo(() => {
    const changed = new Set();
    rows.forEach((row, i) => {
      const original = row[1] !== undefined && row[1] !== null ? String(row[1]) : '';
      if (values[i] !== original) {
        changed.add(i);
      }
    });
    return changed;
  }, [rows, values]);

  const hasChanges = changedRows.size > 0;

  const handleChange = (rowIndex, newValue) => {
    setValues((prev) => ({ ...prev, [rowIndex]: newValue }));
  };

  const handleSave = () => {
    for (const rowIndex of changedRows) {
      const setting = rows[rowIndex][0];
      onSave(rowIndex, [setting, values[rowIndex]]);
    }
  };

  return (
    <div style={containerStyle}>
      {rows.map((row, i) => {
        const setting = row[0];
        const isChanged = changedRows.has(i);

        return (
          <div key={i} style={rowStyle}>
            <span style={labelStyle}>{setting}</span>
            <input
              type="text"
              style={isChanged ? inputChangedStyle : inputStyle}
              value={values[i] || ''}
              onChange={(e) => handleChange(i, e.target.value)}
            />
          </div>
        );
      })}

      <button
        style={hasChanges ? buttonStyle : buttonDisabledStyle}
        disabled={!hasChanges}
        onClick={handleSave}
      >
        Save Changes{hasChanges ? ` (${changedRows.size})` : ''}
      </button>
    </div>
  );
}
