import { server } from 'gas-react';

// ─── CRUD ─────────────────────────────────────────────────────────────────────
server.on('getSheetData',     (req) => CRUD_getSheetData(req.body.sheetName));
server.on('addRow',           (req) => CRUD_addRow(req.body.sheetName, req.body.rowData));
server.on('updateRow',        (req) => CRUD_updateRow(req.body.sheetName, req.body.rowIndex, req.body.rowData));
server.on('deleteRow',        (req) => CRUD_deleteRow(req.body.sheetName, req.body.rowIndex));
server.on('getAllowedSheets', ()    => CRUD_getAllowedSheets());

// ─── SCHEDULING ───────────────────────────────────────────────────────────────
// Added in Session 10

// ─── REPORTS ──────────────────────────────────────────────────────────────────
// Added in Session 12

// ─── ARCHIVE ──────────────────────────────────────────────────────────────────
// Added in Session 13
