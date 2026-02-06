import { useState } from 'react';
import DataPage from './pages/DataPage';
import SchedulingPage from './pages/SchedulingPage';
import ReportsPage from './pages/ReportsPage';
import ArchivePage from './pages/ArchivePage';

const tabs = [
  { key: 'data', label: 'Data' },
  { key: 'scheduling', label: 'Scheduling' },
  { key: 'reports', label: 'Reports' },
  { key: 'archive', label: 'Archive' },
];

const navStyle = {
  display: 'flex',
  gap: '0',
  backgroundColor: '#fff',
  borderBottom: '1px solid #ddd',
  padding: '0 16px',
};

const tabStyle = {
  padding: '12px 24px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  color: '#666',
  borderBottom: '2px solid transparent',
  marginBottom: '-1px',
};

const activeTabStyle = {
  ...tabStyle,
  color: '#1a73e8',
  borderBottom: '2px solid #1a73e8',
};

const contentStyle = {
  padding: '24px',
};

function App() {
  const [activePage, setActivePage] = useState('data');

  const renderPage = () => {
    switch (activePage) {
      case 'data':
        return <DataPage />;
      case 'scheduling':
        return <SchedulingPage />;
      case 'reports':
        return <ReportsPage />;
      case 'archive':
        return <ArchivePage />;
      default:
        return <DataPage />;
    }
  };

  return (
    <div>
      <nav style={navStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            style={activePage === tab.key ? activeTabStyle : tabStyle}
            onClick={() => setActivePage(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main style={contentStyle}>
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
