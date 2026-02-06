const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px',
};

const thStyle = {
  textAlign: 'left',
  padding: '12px 10px',
  borderBottom: '2px solid #dee2e6',
  backgroundColor: '#f8f9fa',
  fontWeight: '600',
  color: '#495057',
};

const tdStyle = {
  padding: '10px',
  borderBottom: '1px solid #dee2e6',
  color: '#333',
};

const actionTdStyle = {
  ...tdStyle,
  whiteSpace: 'nowrap',
  textAlign: 'right',
};

const buttonStyle = {
  padding: '6px 12px',
  fontSize: '12px',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  marginLeft: '6px',
};

const editButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#e3f2fd',
  color: '#1565c0',
};

const deleteButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#ffebee',
  color: '#c62828',
};

const emptyRowStyle = {
  ...tdStyle,
  textAlign: 'center',
  color: '#666',
  fontStyle: 'italic',
  padding: '24px 10px',
};

function formatCellValue(value, column) {
  // Handle boolean/toggle values
  if (column.type === 'toggle') {
    return value === true || value === 'TRUE' || value === true ? 'Yes' : 'No';
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  // Convert to string
  const strValue = String(value);

  // Truncate long text
  if (strValue.length > 40) {
    return strValue.substring(0, 40) + '...';
  }

  return strValue;
}

export default function DataTable({ columns, rows, onEdit, onDelete }) {
  const hasRows = rows && rows.length > 0;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={thStyle}>
                {col.label}
              </th>
            ))}
            <th style={{ ...thStyle, width: '120px' }}></th>
          </tr>
        </thead>
        <tbody>
          {!hasRows ? (
            <tr>
              <td style={emptyRowStyle} colSpan={columns.length + 1}>
                No data. Click Add to create the first entry.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col, colIndex) => (
                  <td key={col.key} style={tdStyle}>
                    {formatCellValue(row[colIndex], col)}
                  </td>
                ))}
                <td style={actionTdStyle}>
                  <button
                    style={editButtonStyle}
                    onClick={() => onEdit(rowIndex)}
                  >
                    Edit
                  </button>
                  <button
                    style={deleteButtonStyle}
                    onClick={() => onDelete(rowIndex)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
