import { useState, useEffect, useCallback } from 'react';
import gasClient from '../services/gasClient';
import StatusMessage from '../components/shared/StatusMessage';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import MonthSelector from '../components/shared/MonthSelector';
import WorkflowStep from '../components/scheduling/WorkflowStep';
import ReviewQueue from '../components/scheduling/ReviewQueue';

const pageStyle = {
  maxWidth: '800px',
  margin: '0 auto',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '24px',
  flexWrap: 'wrap',
  gap: '12px',
};

const titleStyle = {
  fontSize: '22px',
  fontWeight: '600',
  color: '#333',
  margin: 0,
};

const validationResultsStyle = {
  marginTop: '12px',
  fontSize: '13px',
  lineHeight: '1.5',
};

const validationSectionStyle = {
  marginBottom: '8px',
};

const validationHeaderStyle = (type) => ({
  fontWeight: '600',
  color: type === 'error' ? '#c62828' : '#e65100',
  marginBottom: '2px',
});

const validationItemStyle = {
  paddingLeft: '12px',
  color: '#555',
};

const validationSuccessStyle = {
  color: '#2e7d32',
  fontWeight: '500',
};

export default function SchedulingPage() {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [months, setMonths] = useState([]);
  const [stepStatuses, setStepStatuses] = useState({
    step1: 'pending',
    step2: 'pending',
    step3: 'pending',
    step4: 'pending',
    step5: 'pending',
    step6: 'pending',
  });
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [validationResults, setValidationResults] = useState(null);

  useEffect(() => {
    gasClient('getMonths')
      .then((result) => {
        const m = result.months || result || [];
        setMonths(Array.isArray(m) ? m : []);
      })
      .catch(() => {
        setMonths([]);
      });
  }, []);

  const dismissStatus = useCallback(() => {
    setStatus('idle');
    setMessage('');
  }, []);

  const updateStep = (step, newStatus) => {
    setStepStatuses((prev) => ({ ...prev, [step]: newStatus }));
  };

  const closeConfirm = () => {
    setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
  };

  // Step 1: Generate Calendar
  const handleGenerateCalendar = () => {
    setConfirmDialog({
      open: true,
      title: 'Generate Calendar',
      message: 'This will regenerate the entire liturgical calendar for the configured year. Continue?',
      onConfirm: async () => {
        closeConfirm();
        updateStep('step1', 'active');
        setStatus('loading');
        try {
          await gasClient('generateCalendar');
          updateStep('step1', 'complete');
          setStatus('success');
          setMessage('Liturgical calendar generated successfully.');
        } catch (e) {
          updateStep('step1', 'error');
          setStatus('error');
          setMessage(e.message || 'Failed to generate calendar.');
        }
      },
    });
  };

  // Step 2: Validate Data
  const handleValidate = async () => {
    updateStep('step2', 'active');
    setStatus('loading');
    setValidationResults(null);
    try {
      const result = await gasClient('validateData');
      updateStep('step2', 'complete');
      setValidationResults(result);
      const errors = result.errors || [];
      const warnings = result.warnings || [];
      if (errors.length === 0 && warnings.length === 0) {
        setStatus('success');
        setMessage('All validations passed.');
      } else if (errors.length > 0) {
        setStatus('error');
        setMessage(`Validation found ${errors.length} error(s) and ${warnings.length} warning(s).`);
      } else {
        setStatus('success');
        setMessage(`Validation passed with ${warnings.length} warning(s).`);
      }
    } catch (e) {
      updateStep('step2', 'error');
      setStatus('error');
      setMessage(e.message || 'Validation failed.');
    }
  };

  // Step 3: Generate Schedule
  const handleGenerateSchedule = () => {
    const monthDisplay = months.find((m) => m.value === selectedMonth)?.display || selectedMonth;
    setConfirmDialog({
      open: true,
      title: 'Generate Schedule',
      message: `This will clear and regenerate assignments for ${monthDisplay}. Continue?`,
      onConfirm: async () => {
        closeConfirm();
        updateStep('step3', 'active');
        setStatus('loading');
        try {
          await gasClient('generateSchedule', { monthString: selectedMonth });
          updateStep('step3', 'complete');
          setStatus('success');
          setMessage('Schedule generated successfully.');
        } catch (e) {
          updateStep('step3', 'error');
          setStatus('error');
          setMessage(e.message || 'Failed to generate schedule.');
        }
      },
    });
  };

  // Step 4: Update Timeoff Form
  const handleUpdateTimeoffForm = async () => {
    updateStep('step4', 'active');
    setStatus('loading');
    try {
      await gasClient('updateTimeoffForm', { monthString: selectedMonth });
      updateStep('step4', 'complete');
      setStatus('success');
      setMessage('Timeoff form updated successfully.');
    } catch (e) {
      updateStep('step4', 'error');
      setStatus('error');
      setMessage(e.message || 'Failed to update timeoff form.');
    }
  };

  // Step 5: Review Timeoffs count callback
  const handleTimeoffCountChange = useCallback((count) => {
    setStepStatuses((prev) => ({
      ...prev,
      step5: count === 0 ? 'complete' : 'active',
    }));
  }, []);

  // Step 6: Auto-Assign Volunteers
  const handleAutoAssign = async () => {
    updateStep('step6', 'active');
    setStatus('loading');
    try {
      await gasClient('autoAssign', { monthString: selectedMonth });
      updateStep('step6', 'complete');
      setStatus('success');
      setMessage('Volunteers auto-assigned successfully.');
    } catch (e) {
      updateStep('step6', 'error');
      setStatus('error');
      setMessage(e.message || 'Failed to auto-assign volunteers.');
    }
  };

  const renderValidationResults = () => {
    if (!validationResults) return null;
    const errors = validationResults.errors || [];
    const warnings = validationResults.warnings || [];
    if (errors.length === 0 && warnings.length === 0) {
      return <div style={validationSuccessStyle}>All checks passed.</div>;
    }
    return (
      <div style={validationResultsStyle}>
        {errors.length > 0 && (
          <div style={validationSectionStyle}>
            <div style={validationHeaderStyle('error')}>Errors ({errors.length})</div>
            {errors.map((err, i) => (
              <div key={i} style={validationItemStyle}>{err}</div>
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <div style={validationSectionStyle}>
            <div style={validationHeaderStyle('warning')}>Warnings ({warnings.length})</div>
            {warnings.map((warn, i) => (
              <div key={i} style={validationItemStyle}>{warn}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>Scheduling</h2>
        <MonthSelector
          value={selectedMonth}
          onChange={setSelectedMonth}
          months={months}
        />
      </div>

      <StatusMessage status={status} message={message} onDismiss={dismissStatus} />

      <WorkflowStep
        number={1}
        title="Generate Calendar"
        description="Generates the liturgical calendar for the configured year. Run once per year."
        status={stepStatuses.step1}
        action={handleGenerateCalendar}
        actionLabel="Generate Calendar"
        actionDisabled={false}
      />

      <WorkflowStep
        number={2}
        title="Validate Data"
        description="Checks all sheets for errors and warnings before scheduling."
        status={stepStatuses.step2}
        action={handleValidate}
        actionLabel="Validate"
        actionDisabled={false}
      >
        {renderValidationResults()}
      </WorkflowStep>

      <WorkflowStep
        number={3}
        title="Generate Schedule"
        description="Creates the ministry assignment slots for the selected month. Clears any existing assignments."
        status={stepStatuses.step3}
        action={handleGenerateSchedule}
        actionLabel="Generate Schedule"
        actionDisabled={!selectedMonth}
      />

      <WorkflowStep
        number={4}
        title="Update Timeoff Form"
        description="Populates the Google Form with this month's mass dates for volunteer submissions."
        status={stepStatuses.step4}
        action={handleUpdateTimeoffForm}
        actionLabel="Update Form"
        actionDisabled={!selectedMonth}
      />

      <WorkflowStep
        number={5}
        title="Review Timeoffs"
        description="Review and approve/reject pending timeoff requests."
        status={stepStatuses.step5}
        actionDisabled={!selectedMonth}
      >
        {selectedMonth && (
          <ReviewQueue
            monthString={selectedMonth}
            onCountChange={handleTimeoffCountChange}
          />
        )}
      </WorkflowStep>

      <WorkflowStep
        number={6}
        title="Auto-Assign Volunteers"
        description="Automatically assigns qualified volunteers to open ministry roles."
        status={stepStatuses.step6}
        action={handleAutoAssign}
        actionLabel="Auto-Assign"
        actionDisabled={!selectedMonth}
      />

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Continue"
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
