import { useState, useEffect, useCallback } from 'react';
import { SHEETS, SHEET_ORDER } from '../config/sheets';
import gasClient from '../services/gasClient';
import StatusMessage from '../components/shared/StatusMessage';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import DataTable from '../components/crud/DataTable';
import RowForm from '../components/crud/RowForm';

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px',
};

const titleStyle = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#333',
  margin: 0,
};

const addButtonStyle = {
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: '500',
  backgroundColor: '#1a73e8',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
};

export default function DataPage() {
  // State
  const [activeSheet, setActiveSheet] = useState(SHEET_ORDER[0]);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, rowIndex: null });
  const [options, setOptions] = useState({});

  // Get current sheet config
  const sheetConfig = SHEETS[activeSheet];

  // Fetch sheet data
  const fetchData = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await gasClient('getSheetData', { sheetName: sheetConfig.id });
      setRows(result.rows || []);
      setStatus('success');
      setStatusMessage(`Loaded ${result.rows?.length || 0} rows`);

      // Fetch options for columns with optionsFrom
      const optionsToFetch = sheetConfig.columns.filter((col) => col.optionsFrom);
      if (optionsToFetch.length > 0) {
        const newOptions = { ...options };
        for (const col of optionsToFetch) {
          try {
            const optResult = await gasClient('getSheetData', {
              sheetName: col.optionsFrom.sheet,
            });
            // Extract unique values from the specified column
            const colIndex = col.optionsFrom.column;
            const uniqueValues = [
              ...new Set(
                optResult.rows
                  .map((row) => row[colIndex])
                  .filter((val) => val !== null && val !== undefined && val !== '')
              ),
            ];
            newOptions[col.key] = uniqueValues;

            // Handle 'also' property for fetching from multiple sheets
            if (col.optionsFrom.also) {
              for (const alsoSheet of col.optionsFrom.also) {
                const alsoResult = await gasClient('getSheetData', { sheetName: alsoSheet });
                const alsoValues = alsoResult.rows
                  .map((row) => row[colIndex])
                  .filter((val) => val !== null && val !== undefined && val !== '');
                newOptions[col.key] = [...new Set([...newOptions[col.key], ...alsoValues])];
              }
            }
          } catch (err) {
            console.error(`Failed to fetch options for ${col.key}:`, err);
          }
        }
        setOptions(newOptions);
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage(err.message || 'Failed to load data');
    }
  }, [sheetConfig, options]);

  // Fetch data on mount and when activeSheet changes
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheet]);

  // Dismiss status message
  const handleDismiss = () => {
    setStatus('idle');
    setStatusMessage('');
  };

  // Open form for adding new row
  const handleAdd = () => {
    setEditingIndex(null);
    setFormOpen(true);
  };

  // Open form for editing row
  const handleEdit = (rowIndex) => {
    setEditingIndex(rowIndex);
    setFormOpen(true);
  };

  // Open delete confirmation
  const handleDelete = (rowIndex) => {
    setDeleteConfirm({ open: true, rowIndex });
  };

  // Cancel form
  const handleCancel = () => {
    setFormOpen(false);
    setEditingIndex(null);
  };

  // Save row (add or update)
  const handleSave = async (valuesArray) => {
    setStatus('loading');
    try {
      if (editingIndex === null) {
        // Add new row
        await gasClient('addRow', {
          sheetName: sheetConfig.id,
          rowData: valuesArray,
        });
        setStatusMessage('Row added successfully');
      } else {
        // Update existing row
        await gasClient('updateRow', {
          sheetName: sheetConfig.id,
          rowIndex: editingIndex,
          rowData: valuesArray,
        });
        setStatusMessage('Row updated successfully');
      }
      setStatus('success');
      setFormOpen(false);
      setEditingIndex(null);
      // Re-fetch data
      fetchData();
    } catch (err) {
      setStatus('error');
      setStatusMessage(err.message || 'Failed to save');
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    setStatus('loading');
    try {
      await gasClient('deleteRow', {
        sheetName: sheetConfig.id,
        rowIndex: deleteConfirm.rowIndex,
      });
      setStatus('success');
      setStatusMessage('Row deleted successfully');
      setDeleteConfirm({ open: false, rowIndex: null });
      // Re-fetch data
      fetchData();
    } catch (err) {
      setStatus('error');
      setStatusMessage(err.message || 'Failed to delete');
      setDeleteConfirm({ open: false, rowIndex: null });
    }
  };

  // Cancel delete
  const handleCancelDelete = () => {
    setDeleteConfirm({ open: false, rowIndex: null });
  };

  // Prepare columns with resolved options
  const columnsWithOptions = sheetConfig.columns.map((col) => {
    if (col.optionsFrom && options[col.key]) {
      return { ...col, options: options[col.key] };
    }
    return col;
  });

  return (
    <div>
      <StatusMessage status={status} message={statusMessage} onDismiss={handleDismiss} />

      {formOpen ? (
        <>
          <div style={headerStyle}>
            <h2 style={titleStyle}>
              {editingIndex === null ? 'Add' : 'Edit'} {sheetConfig.label}
            </h2>
          </div>
          <RowForm
            columns={columnsWithOptions}
            initialValues={editingIndex !== null ? rows[editingIndex] : null}
            onSave={handleSave}
            onCancel={handleCancel}
            isNew={editingIndex === null}
          />
        </>
      ) : (
        <>
          <div style={headerStyle}>
            <h2 style={titleStyle}>{sheetConfig.label}</h2>
            <button style={addButtonStyle} onClick={handleAdd}>
              + Add
            </button>
          </div>
          <DataTable
            columns={sheetConfig.columns}
            rows={rows}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        title="Delete Row"
        message="Are you sure you want to delete this row? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
