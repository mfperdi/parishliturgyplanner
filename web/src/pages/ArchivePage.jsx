import { useState, useEffect, useCallback } from 'react';
import gasClient from '../services/gasClient';
import StatusMessage from '../components/shared/StatusMessage';
import ConfirmDialog from '../components/shared/ConfirmDialog';

// ─── Styles ──────────────────────────────────────────────────────────────────

const sectionStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '20px',
};

const sectionTitleStyle = {
  margin: '0 0 4px 0',
  fontSize: '16px',
  fontWeight: '600',
  color: '#333',
};

const sectionDescStyle = {
  margin: '0 0 16px 0',
  fontSize: '13px',
  color: '#888',
};

const btnStyle = {
  padding: '8px 16px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: '500',
  cursor: 'pointer',
  border: 'none',
  backgroundColor: '#1a73e8',
  color: '#fff',
};

const btnDisabledStyle = {
  ...btnStyle,
  backgroundColor: '#ccc',
  cursor: 'not-allowed',
};

const btnDangerStyle = {
  ...btnStyle,
  backgroundColor: '#dc3545',
};

const linkStyle = {
  color: '#1a73e8',
  textDecoration: 'none',
  fontWeight: '500',
};

const archiveItemStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  borderBottom: '1px solid #f0f0f0',
  fontSize: '13px',
};

const resultBoxStyle = {
  marginTop: '12px',
  padding: '12px',
  backgroundColor: '#e8f5e9',
  borderRadius: '6px',
  fontSize: '13px',
  color: '#2e7d32',
};

const emptyStyle = {
  fontSize: '13px',
  color: '#888',
  fontStyle: 'italic',
};

const msgStyle = (isError) => ({
  fontSize: '13px',
  marginTop: '8px',
  color: isError ? '#c62828' : '#2e7d32',
});

// ─── Section 1: Archive Current Year ────────────────────────────────────────

function ArchiveYearSection() {
  const currentYear = new Date().getFullYear();
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleArchive = () => {
    setConfirmOpen(false);
    setWorking(true);
    setMsg('');
    setResult(null);
    gasClient('archiveYear', { year: currentYear })
      .then((res) => {
        if (res.success) {
          setResult(res);
        } else {
          setMsg('Error: ' + (res.message || 'Archive failed.'));
        }
      })
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setWorking(false));
  };

  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitleStyle}>Archive Current Year</h3>
      <p style={sectionDescStyle}>
        Create an archive copy of LiturgicalCalendar, Assignments, and Timeoffs for {currentYear}.
        The original sheets will not be modified.
      </p>

      <button
        style={working ? btnDisabledStyle : btnStyle}
        onClick={() => setConfirmOpen(true)}
        disabled={working}
      >
        {working ? 'Archiving...' : `Archive Year ${currentYear}`}
      </button>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Archive Current Year"
        message={`This will create an archive copy of LiturgicalCalendar, Assignments, and Timeoffs for ${currentYear}. The originals will not be deleted.`}
        confirmLabel="Create Archive"
        onConfirm={handleArchive}
        onCancel={() => setConfirmOpen(false)}
      />

      {result && (
        <div style={resultBoxStyle}>
          <div>Archive created: <strong>{result.fileName}</strong></div>
          {result.url && (
            <div style={{ marginTop: '6px' }}>
              <a href={result.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                Open archive spreadsheet
              </a>
            </div>
          )}
        </div>
      )}

      {msg && <div style={msgStyle(msg.startsWith('Error'))}>{msg}</div>}
    </div>
  );
}

// ─── Section 2: View Archives ───────────────────────────────────────────────

function ViewArchivesSection() {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const fetchArchives = useCallback(() => {
    setLoading(true);
    setMsg('');
    gasClient('listArchives')
      .then((res) => {
        const list = Array.isArray(res) ? res : (res.archives || []);
        setArchives(list);
      })
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitleStyle}>View Archives</h3>
      <p style={sectionDescStyle}>Previously created archive files.</p>

      {loading && <div style={emptyStyle}>Loading archives...</div>}

      {!loading && archives.length === 0 && !msg && (
        <div style={emptyStyle}>No archives yet.</div>
      )}

      {!loading && archives.length > 0 && (
        <div style={{ border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
          {archives.map((archive, i) => (
            <div key={archive.id || i} style={archiveItemStyle}>
              <div>
                <strong>{archive.name}</strong>
                {archive.year && (
                  <span style={{ color: '#888', marginLeft: '8px', fontSize: '12px' }}>
                    ({archive.year})
                  </span>
                )}
              </div>
              {archive.url && (
                <a href={archive.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  Open
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {msg && <div style={msgStyle(msg.startsWith('Error'))}>{msg}</div>}
    </div>
  );
}

// ─── Section 3: Clear Old Data ──────────────────────────────────────────────

function ClearOldDataSection() {
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClear = () => {
    setConfirmOpen(false);
    setWorking(true);
    setMsg('');
    setResult(null);
    gasClient('clearOldData', {
      sheetsToRestart: ['LiturgicalCalendar', 'Assignments', 'Timeoffs'],
    })
      .then((res) => {
        if (res.success) {
          setResult(res);
        } else {
          setMsg('Error: ' + (res.message || 'Clear failed.'));
        }
      })
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setWorking(false));
  };

  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitleStyle}>Clear Old Data</h3>
      <p style={sectionDescStyle}>
        Clear LiturgicalCalendar, Assignments, and Timeoffs sheets and reset them to empty (headers only).
        Make sure you have archived first.
      </p>

      <button
        style={working ? btnDisabledStyle : btnDangerStyle}
        onClick={() => setConfirmOpen(true)}
        disabled={working}
      >
        {working ? 'Clearing...' : 'Clear Old Data'}
      </button>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Clear Old Data"
        message="This will clear LiturgicalCalendar, Assignments, and Timeoffs sheets and reset them to empty (headers only). Make sure you have archived first."
        confirmLabel="Clear Data"
        onConfirm={handleClear}
        onCancel={() => setConfirmOpen(false)}
      />

      {result && (
        <div style={resultBoxStyle}>
          <div>{result.message}</div>
          {result.clearedSheets && result.clearedSheets.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              Cleared: {result.clearedSheets.join(', ')}
            </div>
          )}
        </div>
      )}

      {msg && <div style={msgStyle(msg.startsWith('Error'))}>{msg}</div>}
    </div>
  );
}

// ─── Main ArchivePage ───────────────────────────────────────────────────────

export default function ArchivePage() {
  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');

  return (
    <div>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#333' }}>Archive</h2>

      <StatusMessage
        status={status}
        message={statusMessage}
        onDismiss={() => { setStatus('idle'); setStatusMessage(''); }}
      />

      <ArchiveYearSection />
      <ViewArchivesSection />
      <ClearOldDataSection />
    </div>
  );
}
