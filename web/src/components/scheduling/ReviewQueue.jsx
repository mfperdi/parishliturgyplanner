import { useState, useEffect, useCallback } from 'react';
import gasClient from '../../services/gasClient';

const containerStyle = {
  marginTop: '8px',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '12px',
};

const countStyle = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#333',
};

const bulkButtonStyle = {
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: '500',
  borderRadius: '5px',
  border: '1px solid #2e7d32',
  backgroundColor: '#e8f5e9',
  color: '#2e7d32',
  cursor: 'pointer',
};

const cardStyle = {
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
  padding: '14px',
  marginBottom: '10px',
  backgroundColor: '#fafafa',
};

const nameStyle = {
  fontWeight: '600',
  fontSize: '14px',
  color: '#333',
  marginBottom: '4px',
};

const labelStyle = (type) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: '600',
  marginBottom: '6px',
  backgroundColor: type === 'I CANNOT serve these dates' ? '#ffebee' : '#e3f2fd',
  color: type === 'I CANNOT serve these dates' ? '#c62828' : '#1565c0',
});

const detailStyle = {
  fontSize: '13px',
  color: '#555',
  margin: '2px 0',
  lineHeight: '1.4',
};

const warningStyle = {
  fontSize: '12px',
  color: '#e65100',
  backgroundColor: '#fff8e1',
  padding: '4px 8px',
  borderRadius: '4px',
  margin: '6px 0',
};

const actionsStyle = {
  display: 'flex',
  gap: '8px',
  marginTop: '10px',
  alignItems: 'center',
};

const approveButtonStyle = {
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: '500',
  borderRadius: '5px',
  border: 'none',
  backgroundColor: '#2e7d32',
  color: '#fff',
  cursor: 'pointer',
};

const rejectButtonStyle = {
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: '500',
  borderRadius: '5px',
  border: 'none',
  backgroundColor: '#c62828',
  color: '#fff',
  cursor: 'pointer',
};

const rejectInputStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginTop: '8px',
};

const inputStyle = {
  padding: '6px 10px',
  fontSize: '12px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  flex: 1,
};

const cancelLinkStyle = {
  fontSize: '12px',
  color: '#666',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  textDecoration: 'underline',
};

const emptyStyle = {
  fontSize: '13px',
  color: '#888',
  fontStyle: 'italic',
  padding: '8px 0',
};

const spinnerSmallStyle = {
  fontSize: '13px',
  color: '#1565c0',
  padding: '8px 0',
};

const errorSmallStyle = {
  fontSize: '13px',
  color: '#c62828',
  padding: '8px 0',
};

export default function ReviewQueue({ monthString, onCountChange }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rejectingIndex, setRejectingIndex] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchPending = useCallback(async () => {
    if (!monthString) return;
    setLoading(true);
    setError(null);
    try {
      const result = await gasClient('getPendingTimeoffs', { monthString });
      const items = result.pending || [];
      setPending(items);
      if (onCountChange) onCountChange(items.length);
    } catch (e) {
      setError(e.message || 'Failed to load timeoff requests');
    } finally {
      setLoading(false);
    }
  }, [monthString, onCountChange]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (dataIndex) => {
    setActionLoading(dataIndex);
    try {
      await gasClient('approveTimeoff', { rowIndex: dataIndex, notes: '' });
      await fetchPending();
    } catch (e) {
      setError(e.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async (dataIndex) => {
    setActionLoading(dataIndex);
    try {
      await gasClient('rejectTimeoff', { rowIndex: dataIndex, notes: rejectNotes });
      setRejectingIndex(null);
      setRejectNotes('');
      await fetchPending();
    } catch (e) {
      setError(e.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    setActionLoading('bulk');
    try {
      await gasClient('bulkApproveClean');
      await fetchPending();
    } catch (e) {
      setError(e.message || 'Failed to bulk approve');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div style={spinnerSmallStyle}>Loading timeoff requests...</div>;
  }

  if (error) {
    return <div style={errorSmallStyle}>Error: {error}</div>;
  }

  if (pending.length === 0) {
    return <div style={emptyStyle}>No pending timeoff requests for this month.</div>;
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={countStyle}>{pending.length} pending request{pending.length !== 1 ? 's' : ''}</span>
        <button
          style={bulkButtonStyle}
          onClick={handleBulkApprove}
          disabled={actionLoading === 'bulk'}
        >
          {actionLoading === 'bulk' ? 'Approving...' : 'Bulk Approve Clean'}
        </button>
      </div>

      {pending.map((item) => (
        <div key={item.dataIndex} style={cardStyle}>
          <div style={nameStyle}>{item.name}</div>
          <div style={labelStyle(item.type)}>
            {item.type === 'I CANNOT serve these dates' ? 'Blacklist' : 'Whitelist'}
          </div>
          <div style={detailStyle}>
            <strong>Dates:</strong> {item.selectedDates}
          </div>
          {item.volunteerNotes && (
            <div style={detailStyle}>
              <strong>Notes:</strong> {item.volunteerNotes}
            </div>
          )}
          {item.reviewNotes && (
            <div style={warningStyle}>{item.reviewNotes}</div>
          )}

          {rejectingIndex === item.dataIndex ? (
            <div style={rejectInputStyle}>
              <input
                style={inputStyle}
                type="text"
                placeholder="Rejection notes (optional)"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
              />
              <button
                style={rejectButtonStyle}
                onClick={() => handleRejectSubmit(item.dataIndex)}
                disabled={actionLoading === item.dataIndex}
              >
                {actionLoading === item.dataIndex ? 'Rejecting...' : 'Confirm Reject'}
              </button>
              <button
                style={cancelLinkStyle}
                onClick={() => { setRejectingIndex(null); setRejectNotes(''); }}
              >
                cancel
              </button>
            </div>
          ) : (
            <div style={actionsStyle}>
              <button
                style={approveButtonStyle}
                onClick={() => handleApprove(item.dataIndex)}
                disabled={actionLoading === item.dataIndex}
              >
                {actionLoading === item.dataIndex ? 'Approving...' : 'Approve'}
              </button>
              <button
                style={rejectButtonStyle}
                onClick={() => setRejectingIndex(item.dataIndex)}
                disabled={actionLoading === item.dataIndex}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
