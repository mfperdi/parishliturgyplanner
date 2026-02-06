const selectStyle = {
  padding: '10px 14px',
  fontSize: '14px',
  borderRadius: '6px',
  border: '1px solid #ccc',
  backgroundColor: '#fff',
  cursor: 'pointer',
  minWidth: '200px',
};

export default function MonthSelector({ value, onChange, months }) {
  const hasMonths = months && months.length > 0;

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  if (!hasMonths) {
    return (
      <select style={selectStyle} disabled>
        <option>No months available</option>
      </select>
    );
  }

  return (
    <select style={selectStyle} value={value || ''} onChange={handleChange}>
      <option value="" disabled>
        Select a month...
      </option>
      {months.map((month) => (
        <option key={month.value} value={month.value}>
          {month.display}
        </option>
      ))}
    </select>
  );
}
