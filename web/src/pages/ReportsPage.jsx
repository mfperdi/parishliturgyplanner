import { useState, useEffect, useCallback } from 'react';
import gasClient from '../services/gasClient';
import StatusMessage from '../components/shared/StatusMessage';
import MonthSelector from '../components/shared/MonthSelector';

// ─── Styles ──────────────────────────────────────────────────────────────────

const panelStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '20px',
};

const panelTitleStyle = {
  margin: '0 0 4px 0',
  fontSize: '16px',
  fontWeight: '600',
  color: '#333',
};

const panelDescStyle = {
  margin: '0 0 16px 0',
  fontSize: '13px',
  color: '#888',
};

const controlRowStyle = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: '12px',
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

const btnSecondaryStyle = {
  ...btnStyle,
  backgroundColor: '#6c757d',
};

const btnSuccessStyle = {
  ...btnStyle,
  backgroundColor: '#28a745',
};

const btnDangerStyle = {
  ...btnStyle,
  backgroundColor: '#dc3545',
};

const selectStyle = {
  padding: '8px 12px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #ccc',
  backgroundColor: '#fff',
  minWidth: '180px',
};

const inputStyle = {
  padding: '8px 12px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #ccc',
  minWidth: '200px',
};

const textareaStyle = {
  width: '100%',
  padding: '10px',
  fontSize: '13px',
  fontFamily: 'monospace',
  borderRadius: '6px',
  border: '1px solid #ccc',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const statusBadgeStyle = (enabled) => ({
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: '12px',
  fontSize: '12px',
  fontWeight: '500',
  backgroundColor: enabled ? '#e8f5e9' : '#ffebee',
  color: enabled ? '#2e7d32' : '#c62828',
});

const subSectionStyle = {
  borderTop: '1px solid #eee',
  paddingTop: '14px',
  marginTop: '14px',
};

const labelStyle = {
  fontSize: '13px',
  fontWeight: '500',
  color: '#555',
  marginBottom: '4px',
};

const infoRowStyle = {
  fontSize: '13px',
  color: '#555',
  marginBottom: '6px',
};

const copiedBadgeStyle = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  backgroundColor: '#e8f5e9',
  color: '#2e7d32',
  marginLeft: '8px',
};

// ─── Panel 1: Monthly Views ─────────────────────────────────────────────────

function MonthlyViewsPanel({ ministries, loading }) {
  const [viewStatus, setViewStatus] = useState(null);
  const [filter, setFilter] = useState('');
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchStatus = useCallback(() => {
    gasClient('getMonthlyViewStatus')
      .then((res) => setViewStatus(res))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleFilterChange = (e) => {
    const ministry = e.target.value;
    setFilter(ministry);
    setWorking(true);
    setMsg('');
    gasClient('setMonthlyViewFilter', { ministry })
      .then(() => {
        setMsg('Filter updated.');
        fetchStatus();
      })
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setWorking(false));
  };

  const handleRegenerate = () => {
    setWorking(true);
    setMsg('');
    gasClient('regenerateViews')
      .then(() => {
        setMsg('Views regenerated.');
        fetchStatus();
      })
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setWorking(false));
  };

  return (
    <div style={panelStyle}>
      <h3 style={panelTitleStyle}>Monthly Views</h3>
      <p style={panelDescStyle}>Manage the auto-generated monthly and weekly view sheets.</p>

      {viewStatus && (
        <div style={{ marginBottom: '12px' }}>
          {viewStatus.currentMonth && (
            <div style={infoRowStyle}>
              Current month: <strong>{viewStatus.currentMonth.name || 'MonthlyView'}</strong>{' '}
              {viewStatus.currentMonth.exists ? '(exists)' : '(not created)'}
            </div>
          )}
          {viewStatus.nextMonth && (
            <div style={infoRowStyle}>
              Next month: <strong>{viewStatus.nextMonth.name || '—'}</strong>{' '}
              {viewStatus.nextMonth.exists ? '(exists)' : '(not created)'}
            </div>
          )}
          {viewStatus.currentFilter && (
            <div style={infoRowStyle}>
              Current filter: <strong>{viewStatus.currentFilter}</strong>
            </div>
          )}
        </div>
      )}

      <div style={controlRowStyle}>
        <select
          style={selectStyle}
          value={filter}
          onChange={handleFilterChange}
          disabled={working || loading}
        >
          <option value="">All Ministries</option>
          {ministries.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <button
          style={working ? btnDisabledStyle : btnStyle}
          onClick={handleRegenerate}
          disabled={working}
        >
          {working ? 'Working...' : 'Regenerate Views'}
        </button>
      </div>

      {msg && <div style={{ fontSize: '13px', color: msg.startsWith('Error') ? '#c62828' : '#2e7d32' }}>{msg}</div>}
    </div>
  );
}

// ─── Panel 2: Custom Print ──────────────────────────────────────────────────

function CustomPrintPanel({ ministries, months, loading }) {
  const [month, setMonth] = useState('');
  const [ministry, setMinistry] = useState('');
  const [sheetName, setSheetName] = useState('Monthly Schedule');
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState('');

  // Auto-suggest sheet name when ministry or month changes
  useEffect(() => {
    if (ministry && ministry !== '') {
      setSheetName(ministry + ' Schedule');
    } else {
      setSheetName('Monthly Schedule');
    }
  }, [ministry]);

  const handleGenerate = () => {
    setWorking(true);
    setMsg('');
    gasClient('generateCustomPrint', {
      monthString: month,
      ministry: ministry || 'All Ministries',
      sheetName,
    })
      .then(() => setMsg('Print schedule generated as "' + sheetName + '".'))
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setWorking(false));
  };

  return (
    <div style={panelStyle}>
      <h3 style={panelTitleStyle}>Custom Print</h3>
      <p style={panelDescStyle}>Generate a formatted printable schedule sheet.</p>

      <div style={controlRowStyle}>
        <div>
          <div style={labelStyle}>Month</div>
          <MonthSelector value={month} onChange={setMonth} months={months} />
        </div>

        <div>
          <div style={labelStyle}>Ministry</div>
          <select style={selectStyle} value={ministry} onChange={(e) => setMinistry(e.target.value)} disabled={loading}>
            <option value="">All Ministries</option>
            {ministries.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <div style={labelStyle}>Sheet Name</div>
          <input
            style={inputStyle}
            type="text"
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
          />
        </div>
      </div>

      <button
        style={!month || working ? btnDisabledStyle : btnStyle}
        onClick={handleGenerate}
        disabled={!month || working}
      >
        {working ? 'Generating...' : 'Generate'}
      </button>

      {msg && <div style={{ fontSize: '13px', marginTop: '8px', color: msg.startsWith('Error') ? '#c62828' : '#2e7d32' }}>{msg}</div>}
    </div>
  );
}

// ─── Panel 3: Weekly Email ──────────────────────────────────────────────────

function WeeklyEmailPanel() {
  const [working, setWorking] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [weekLabel, setWeekLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState('');

  const handleGenerate = () => {
    setWorking(true);
    setMsg('');
    setEmailText('');
    setWeekLabel('');
    gasClient('getWeeklyEmailText')
      .then((res) => {
        const text = typeof res === 'string' ? res : (res.text || res.schedule || JSON.stringify(res, null, 2));
        const week = res.weekString || res.weekLabel || '';
        setEmailText(text);
        setWeekLabel(week);
      })
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setWorking(false));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(emailText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={panelStyle}>
      <h3 style={panelTitleStyle}>Weekly Email</h3>
      <p style={panelDescStyle}>Generate a text-based schedule for this week to copy into an email.</p>

      <button
        style={working ? btnDisabledStyle : btnStyle}
        onClick={handleGenerate}
        disabled={working}
      >
        {working ? 'Generating...' : 'Generate'}
      </button>

      {msg && <div style={{ fontSize: '13px', marginTop: '8px', color: '#c62828' }}>{msg}</div>}

      {emailText && (
        <div style={{ marginTop: '12px' }}>
          {weekLabel && <div style={{ ...labelStyle, marginBottom: '6px' }}>{weekLabel}</div>}
          <textarea
            style={textareaStyle}
            rows={10}
            value={emailText}
            readOnly
          />
          <div style={{ marginTop: '6px' }}>
            <button style={btnSecondaryStyle} onClick={handleCopy}>
              Copy to Clipboard
            </button>
            {copied && <span style={copiedBadgeStyle}>Copied!</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel 4: Dashboard ─────────────────────────────────────────────────────

function DashboardPanel({ months }) {
  const [month, setMonth] = useState('');
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState('');

  const handleGenerate = () => {
    setWorking(true);
    setMsg('');
    gasClient('generateDashboard', { monthString: month })
      .then(() => setMsg('Dashboard generated. Check the Dashboard sheet in your spreadsheet.'))
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setWorking(false));
  };

  return (
    <div style={panelStyle}>
      <h3 style={panelTitleStyle}>Dashboard</h3>
      <p style={panelDescStyle}>Generate analytics dashboard with volunteer utilization and coverage stats.</p>

      <div style={controlRowStyle}>
        <MonthSelector value={month} onChange={setMonth} months={months} />

        <button
          style={!month || working ? btnDisabledStyle : btnStyle}
          onClick={handleGenerate}
          disabled={!month || working}
        >
          {working ? 'Generating...' : 'Generate Dashboard'}
        </button>
      </div>

      {msg && <div style={{ fontSize: '13px', color: msg.startsWith('Error') ? '#c62828' : '#2e7d32' }}>{msg}</div>}
    </div>
  );
}

// ─── Panel 5: Publish ───────────────────────────────────────────────────────

function PublishPanel({ ministries, months, loading }) {
  const [autoStatus, setAutoStatus] = useState(null);
  const [publishMonth, setPublishMonth] = useState('');
  const [indivMonth, setIndivMonth] = useState('');
  const [indivMinistry, setIndivMinistry] = useState('');
  const [working, setWorking] = useState('');
  const [msg, setMsg] = useState('');

  const fetchAutoStatus = useCallback(() => {
    gasClient('getAutoPublishStatus')
      .then((res) => setAutoStatus(res))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAutoStatus();
  }, [fetchAutoStatus]);

  const handlePublishAll = () => {
    setWorking('all');
    setMsg('');
    gasClient('publishAll', { monthString: publishMonth })
      .then(() => setMsg('All ministries published.'))
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setWorking(''));
  };

  const handlePublishMinistry = () => {
    setWorking('indiv');
    setMsg('');
    gasClient('publishMinistry', { monthString: indivMonth, ministry: indivMinistry })
      .then(() => setMsg(indivMinistry + ' published.'))
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setWorking(''));
  };

  const handleToggleAuto = () => {
    const enabling = !(autoStatus && autoStatus.enabled);
    setWorking('auto');
    setMsg('');
    const route = enabling ? 'enableAutoPublish' : 'disableAutoPublish';
    gasClient(route)
      .then(() => {
        setMsg(enabling ? 'Auto-publish enabled.' : 'Auto-publish disabled.');
        fetchAutoStatus();
      })
      .catch((err) => setMsg('Error: ' + (err.message || err)))
      .finally(() => setWorking(''));
  };

  const isAutoEnabled = autoStatus && autoStatus.enabled;

  return (
    <div style={panelStyle}>
      <h3 style={panelTitleStyle}>Publish</h3>
      <p style={panelDescStyle}>Publish schedules to the public-facing spreadsheet.</p>

      {/* Sub-section A: Publish All */}
      <div>
        <div style={labelStyle}>Publish All Ministries</div>
        <div style={controlRowStyle}>
          <MonthSelector value={publishMonth} onChange={setPublishMonth} months={months} />
          <button
            style={!publishMonth || working === 'all' ? btnDisabledStyle : btnSuccessStyle}
            onClick={handlePublishAll}
            disabled={!publishMonth || working === 'all'}
          >
            {working === 'all' ? 'Publishing...' : 'Publish All'}
          </button>
        </div>
      </div>

      {/* Sub-section B: Publish Individual */}
      <div style={subSectionStyle}>
        <div style={labelStyle}>Publish Individual Ministry</div>
        <div style={controlRowStyle}>
          <MonthSelector value={indivMonth} onChange={setIndivMonth} months={months} />
          <select
            style={selectStyle}
            value={indivMinistry}
            onChange={(e) => setIndivMinistry(e.target.value)}
            disabled={loading}
          >
            <option value="">Select ministry...</option>
            {ministries.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            style={!indivMonth || !indivMinistry || working === 'indiv' ? btnDisabledStyle : btnSuccessStyle}
            onClick={handlePublishMinistry}
            disabled={!indivMonth || !indivMinistry || working === 'indiv'}
          >
            {working === 'indiv' ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Sub-section C: Auto-Publish */}
      <div style={subSectionStyle}>
        <div style={labelStyle}>Auto-Publish</div>
        <div style={{ ...controlRowStyle, alignItems: 'center' }}>
          <span style={statusBadgeStyle(isAutoEnabled)}>
            {isAutoEnabled ? 'Enabled' : 'Disabled'}
          </span>
          {isAutoEnabled && autoStatus.interval && (
            <span style={{ fontSize: '12px', color: '#888' }}>
              every {autoStatus.interval} minutes
            </span>
          )}
          <button
            style={working === 'auto' ? btnDisabledStyle : (isAutoEnabled ? btnDangerStyle : btnSuccessStyle)}
            onClick={handleToggleAuto}
            disabled={working === 'auto'}
          >
            {working === 'auto'
              ? 'Working...'
              : isAutoEnabled
                ? 'Disable Auto-Publish'
                : 'Enable Auto-Publish'}
          </button>
        </div>
      </div>

      {msg && <div style={{ fontSize: '13px', marginTop: '8px', color: msg.startsWith('Error') ? '#c62828' : '#2e7d32' }}>{msg}</div>}
    </div>
  );
}

// ─── Main ReportsPage ────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [ministries, setMinistries] = useState([]);
  const [months, setMonths] = useState([]);
  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [loadingInit, setLoadingInit] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      gasClient('getActiveMinistries'),
      gasClient('getNext12Months'),
    ])
      .then(([ministriesRes, monthsRes]) => {
        if (cancelled) return;
        // getActiveMinistries may return an array or { ministries: [...] }
        const mList = Array.isArray(ministriesRes)
          ? ministriesRes
          : (ministriesRes.ministries || []);
        setMinistries(mList);

        // getNext12Months may return an array or { months: [...] }
        const mths = Array.isArray(monthsRes)
          ? monthsRes
          : (monthsRes.months || []);
        // Normalize to { value, display } if needed
        const normalized = mths.map((m) => {
          if (typeof m === 'string') {
            return { value: m, display: m };
          }
          return m;
        });
        setMonths(normalized);
        setLoadingInit(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setStatusMessage('Failed to load page data: ' + (err.message || err));
        setLoadingInit(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#333' }}>Reports</h2>

      <StatusMessage
        status={status}
        message={statusMessage}
        onDismiss={() => { setStatus('idle'); setStatusMessage(''); }}
      />

      <MonthlyViewsPanel ministries={ministries} loading={loadingInit} />
      <CustomPrintPanel ministries={ministries} months={months} loading={loadingInit} />
      <WeeklyEmailPanel />
      <DashboardPanel months={months} />
      <PublishPanel ministries={ministries} months={months} loading={loadingInit} />
    </div>
  );
}
