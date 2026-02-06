import { useState, useEffect } from 'react';
import { FIELD_COMPONENTS } from './fields';

const formContainerStyle = {
  backgroundColor: '#fff',
  border: '1px solid #dee2e6',
  borderRadius: '8px',
  padding: '24px',
};

const readonlyFieldStyle = {
  marginBottom: '16px',
};

const readonlyLabelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '14px',
  fontWeight: '500',
  color: '#333',
};

const readonlyValueStyle = {
  padding: '10px 12px',
  fontSize: '14px',
  backgroundColor: '#f8f9fa',
  borderRadius: '6px',
  border: '1px solid #dee2e6',
  color: '#495057',
};

const buttonContainerStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  marginTop: '24px',
  paddingTop: '16px',
  borderTop: '1px solid #dee2e6',
};

const buttonStyle = {
  padding: '10px 24px',
  fontSize: '14px',
  fontWeight: '500',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
};

const saveButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#1a73e8',
  color: '#fff',
};

const cancelButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#6c757d',
  color: '#fff',
};

export default function RowForm({ columns, initialValues, onSave, onCancel, isNew }) {
  // Initialize values from initialValues or defaults
  const [values, setValues] = useState(() => {
    if (initialValues) {
      return [...initialValues];
    }
    // Create default values for new rows
    return columns.map((col) => {
      if (col.default !== undefined) {
        return col.default;
      }
      if (col.type === 'toggle') {
        return false;
      }
      return '';
    });
  });

  const [errors, setErrors] = useState({});

  // Reset values when initialValues changes
  useEffect(() => {
    if (initialValues) {
      setValues([...initialValues]);
    } else {
      setValues(
        columns.map((col) => {
          if (col.default !== undefined) {
            return col.default;
          }
          if (col.type === 'toggle') {
            return false;
          }
          return '';
        })
      );
    }
    setErrors({});
  }, [initialValues, columns]);

  const handleValueChange = (index, newValue) => {
    const newValues = [...values];
    newValues[index] = newValue;
    setValues(newValues);
    // Clear error when user starts typing
    if (errors[index]) {
      const newErrors = { ...errors };
      delete newErrors[index];
      setErrors(newErrors);
    }
  };

  const validateAndSave = () => {
    const newErrors = {};

    // Check required fields
    columns.forEach((col, index) => {
      if (col.required) {
        const value = values[index];
        if (value === null || value === undefined || value === '') {
          newErrors[index] = `${col.label} is required`;
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Handle computed fields
    const finalValues = [...values];
    columns.forEach((col, index) => {
      if (col.computed) {
        // Currently only Full Name is computed (firstName + lastName)
        // Find firstName and lastName indices
        const firstNameIndex = columns.findIndex((c) => c.key === 'firstName');
        const lastNameIndex = columns.findIndex((c) => c.key === 'lastName');
        if (firstNameIndex !== -1 && lastNameIndex !== -1) {
          const firstName = finalValues[firstNameIndex] || '';
          const lastName = finalValues[lastNameIndex] || '';
          finalValues[index] = `${firstName} ${lastName}`.trim();
        }
      }
    });

    onSave(finalValues);
  };

  return (
    <div style={formContainerStyle}>
      {columns.map((col, index) => {
        // Skip readonly fields for new rows
        if (col.type === 'readonly' && isNew) {
          return null;
        }

        // Render readonly fields as static text
        if (col.type === 'readonly') {
          return (
            <div key={col.key} style={readonlyFieldStyle}>
              <label style={readonlyLabelStyle}>{col.label}</label>
              <div style={readonlyValueStyle}>{values[index] || '—'}</div>
            </div>
          );
        }

        // Get the appropriate field component
        const FieldComponent = FIELD_COMPONENTS[col.type];
        if (!FieldComponent) {
          console.warn(`Unknown field type: ${col.type}`);
          return null;
        }

        return (
          <FieldComponent
            key={col.key}
            label={col.label}
            value={values[index]}
            onChange={(newValue) => handleValueChange(index, newValue)}
            error={errors[index]}
            disabled={false}
            options={col.options}
          />
        );
      })}

      <div style={buttonContainerStyle}>
        <button style={cancelButtonStyle} onClick={onCancel}>
          Cancel
        </button>
        <button style={saveButtonStyle} onClick={validateAndSave}>
          {isNew ? 'Add' : 'Save'}
        </button>
      </div>
    </div>
  );
}
