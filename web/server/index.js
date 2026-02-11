import { server } from 'gas-react';

// ─── CRUD ─────────────────────────────────────────────────────────────────────
server.on('getSheetData',     (req) => CRUD_getSheetData(req.body.sheetName));
server.on('addRow',           (req) => CRUD_addRow(req.body.sheetName, req.body.rowData));
server.on('updateRow',        (req) => CRUD_updateRow(req.body.sheetName, req.body.rowIndex, req.body.rowData));
server.on('deleteRow',        (req) => CRUD_deleteRow(req.body.sheetName, req.body.rowIndex));
server.on('getAllowedSheets', ()    => CRUD_getAllowedSheets());

// ─── SCHEDULING ───────────────────────────────────────────────────────────────
server.on('getMonths',           ()    => getMonthsForSidebar());
server.on('generateCalendar',   ()    => triggerCalendarGeneration());
server.on('validateData',       ()    => VALIDATE_all());
server.on('generateSchedule',   (req) => triggerScheduleGeneration(req.body.monthString));
server.on('updateTimeoffForm',  (req) => TIMEOFFS_updateFormForMonth(req.body.monthString));
server.on('getPendingTimeoffs', (req) => WEBAPP_getPendingTimeoffs(req.body.monthString));
server.on('approveTimeoff',     (req) => WEBAPP_approveTimeoff(req.body.rowIndex, req.body.notes));
server.on('rejectTimeoff',      (req) => WEBAPP_rejectTimeoff(req.body.rowIndex, req.body.notes));
server.on('bulkApproveClean',   ()    => TIMEOFFS_bulkApprovePending());
server.on('autoAssign',         (req) => triggerAssignment(req.body.monthString));

// ─── REPORTS ──────────────────────────────────────────────────────────────────
// Added in Session 12

// ─── ARCHIVE ──────────────────────────────────────────────────────────────────
// Added in Session 13
