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
server.on('getActiveMinistries',    ()    => getActiveMinistries());
server.on('getNext12Months',        ()    => getNext12Months());
server.on('getMonthlyViewStatus',   ()    => getCurrentMonthlyViewStatus());
server.on('setMonthlyViewFilter',   (req) => setMonthlyViewMinistryFilter(req.body.ministry));
server.on('regenerateViews',        ()    => regenerateMonthlyViewsManually());
server.on('generateCustomPrint',    (req) => generateCustomPrint(req.body.monthString, req.body.ministry, req.body.sheetName));
server.on('getWeeklyEmailText',     ()    => getScheduleForEmailCopy({}));
server.on('generateDashboard',      (req) => DASHBOARD_generateSimplified(req.body.monthString));
server.on('publishAll',             (req) => PUBLISH_publishAllMinistries(req.body.monthString));
server.on('publishMinistry',        (req) => PUBLISH_syncMonthlyViewToPublic(req.body.monthString, { ministryFilter: [req.body.ministry] }));
server.on('getAutoPublishStatus',   ()    => AUTOPUBLISH_getStatus());
server.on('enableAutoPublish',      ()    => AUTOPUBLISH_setupTrigger(30));
server.on('disableAutoPublish',     ()    => AUTOPUBLISH_removeTrigger());

// ─── ARCHIVE ──────────────────────────────────────────────────────────────────
server.on('archiveYear',   (req) => ARCHIVE_createArchiveFile(req.body.year));
server.on('listArchives',  ()    => ARCHIVE_listArchives());
server.on('clearOldData',  (req) => ARCHIVE_clearOldData(req.body.sheetsToRestart));
