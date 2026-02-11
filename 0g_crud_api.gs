const paths__={},mwBefore__=[],mwAfter__=[];
/**
 * Web App entry point.
 * - Normal access: Serves the React web app (index.html)
 * - Debug mode: Add ?debug=1 to the deployment URL to see deployment diagnostics
 *
 * Common deployment issues:
 * 1. Blank page = React app JS error (check browser console F12)
 * 2. "Script function not found" = doGet not deployed (create New Deployment)
 * 3. Access denied = Check "Who has access" in deployment settings
 * 4. Stale content = You must create a NEW deployment version (not re-test old one)
 */
function doGet(e) {
  try {
    // Debug mode: ?debug=1 shows deployment diagnostics instead of the app
    if (e && e.parameter && e.parameter.debug === '1') {
      return _doGetDebugPage();
    }

    var html = HtmlService.createHtmlOutputFromFile('index');
    html.setTitle('Parish Liturgical Scheduler');
    html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    // Set a generous sandbox for the React app
    html.setSandboxMode(HtmlService.SandboxMode.IFRAME);
    return html;
  } catch (err) {
    // If the main app fails, return a helpful error page instead of blank screen
    Logger.log('doGet ERROR: ' + err.message + '\n' + err.stack);
    var errorHtml = '<html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">'
      + '<h2 style="color:#c00;">Web App Error</h2>'
      + '<p>The web app failed to load. Details below:</p>'
      + '<pre style="background:#f5f5f5;padding:16px;border-radius:4px;overflow:auto;">'
      + err.message + '</pre>'
      + '<h3>Troubleshooting</h3>'
      + '<ul>'
      + '<li><b>index.html missing?</b> Run <code>npm run bundle:deploy</code> in the <code>web/</code> folder to generate it.</li>'
      + '<li><b>File too large?</b> Google Apps Script has a ~500KB HTML limit. Current index.html may be too large.</li>'
      + '<li><b>Check Executions log</b> in Apps Script editor: View &gt; Executions</li>'
      + '</ul>'
      + '<p><a href="?debug=1">Run deployment diagnostics &rarr;</a></p>'
      + '</body></html>';
    return HtmlService.createHtmlOutput(errorHtml)
      .setTitle('Parish Scheduler - Error')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

/**
 * Generates a debug diagnostics page for troubleshooting deployment.
 * Access via: YOUR_DEPLOYMENT_URL?debug=1
 */
function _doGetDebugPage() {
  var checks = [];

  // Check 1: Can we access the spreadsheet?
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      checks.push({ name: 'Spreadsheet Access', status: 'PASS', detail: 'Name: ' + ss.getName() });
    } else {
      checks.push({ name: 'Spreadsheet Access', status: 'FAIL', detail: 'getActiveSpreadsheet() returned null. If deployed as standalone (not container-bound), this is expected.' });
    }
  } catch (err) {
    checks.push({ name: 'Spreadsheet Access', status: 'FAIL', detail: err.message });
  }

  // Check 2: Does index.html exist?
  try {
    var html = HtmlService.createHtmlOutputFromFile('index');
    var content = html.getContent();
    checks.push({ name: 'index.html File', status: 'PASS', detail: 'Found. Size: ~' + Math.round(content.length / 1024) + ' KB' });
    if (content.length > 500000) {
      checks.push({ name: 'index.html Size Warning', status: 'WARN', detail: 'File is ' + Math.round(content.length / 1024) + ' KB. GAS limit is ~500 KB. Large files may cause slow loads.' });
    }
  } catch (err) {
    checks.push({ name: 'index.html File', status: 'FAIL', detail: 'Could not load index.html: ' + err.message + '. Run npm run bundle:deploy in web/ folder.' });
  }

  // Check 3: Does DeploymentDebug.html exist (optional)?
  try {
    HtmlService.createHtmlOutputFromFile('DeploymentDebug');
    checks.push({ name: 'DeploymentDebug.html', status: 'PASS', detail: 'Found (optional test page).' });
  } catch (err) {
    checks.push({ name: 'DeploymentDebug.html', status: 'INFO', detail: 'Not found (optional, not required).' });
  }

  // Check 4: Check key sheets exist
  var requiredSheets = ['Config', 'Volunteers', 'Assignments', 'LiturgicalCalendar', 'Ministries'];
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      for (var i = 0; i < requiredSheets.length; i++) {
        var sheet = ss.getSheetByName(requiredSheets[i]);
        if (sheet) {
          checks.push({ name: 'Sheet: ' + requiredSheets[i], status: 'PASS', detail: sheet.getLastRow() + ' rows' });
        } else {
          checks.push({ name: 'Sheet: ' + requiredSheets[i], status: 'WARN', detail: 'Sheet not found' });
        }
      }
    }
  } catch (err) {
    checks.push({ name: 'Sheet Access', status: 'FAIL', detail: err.message });
  }

  // Check 5: CRUD API functions available?
  var apiFuncs = ['CRUD_getSheetData', 'CRUD_addRow', 'CRUD_updateRow', 'CRUD_deleteRow', 'CRUD_getAllowedSheets'];
  for (var j = 0; j < apiFuncs.length; j++) {
    try {
      if (typeof this[apiFuncs[j]] === 'function') {
        checks.push({ name: 'API: ' + apiFuncs[j], status: 'PASS', detail: 'Function exists' });
      } else {
        checks.push({ name: 'API: ' + apiFuncs[j], status: 'WARN', detail: 'Function not found in global scope' });
      }
    } catch (err) {
      checks.push({ name: 'API: ' + apiFuncs[j], status: 'WARN', detail: err.message });
    }
  }

  // Build HTML report
  var html = '<html><head><style>'
    + 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; background: #fafafa; }'
    + 'h1 { color: #333; border-bottom: 2px solid #4285f4; padding-bottom: 8px; }'
    + '.check { padding: 10px 14px; margin: 6px 0; border-radius: 6px; display: flex; align-items: center; gap: 10px; }'
    + '.PASS { background: #e6f4ea; border-left: 4px solid #34a853; }'
    + '.FAIL { background: #fce8e6; border-left: 4px solid #ea4335; }'
    + '.WARN { background: #fef7e0; border-left: 4px solid #fbbc04; }'
    + '.INFO { background: #e8f0fe; border-left: 4px solid #4285f4; }'
    + '.badge { font-weight: bold; font-size: 12px; padding: 2px 8px; border-radius: 3px; color: white; min-width: 40px; text-align: center; }'
    + '.badge.PASS { background: #34a853; } .badge.FAIL { background: #ea4335; } .badge.WARN { background: #fbbc04; color: #333; } .badge.INFO { background: #4285f4; }'
    + '.name { font-weight: 600; min-width: 200px; } .detail { color: #555; font-size: 14px; }'
    + 'h2 { margin-top: 30px; color: #555; }'
    + 'code { background: #e8e8e8; padding: 2px 6px; border-radius: 3px; font-size: 13px; }'
    + 'a.btn { display: inline-block; padding: 10px 20px; background: #4285f4; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px; }'
    + '</style></head><body>'
    + '<h1>Deployment Diagnostics</h1>'
    + '<p>Generated: ' + new Date().toLocaleString() + '</p>';

  for (var k = 0; k < checks.length; k++) {
    var c = checks[k];
    html += '<div class="check ' + c.status + '">'
      + '<span class="badge ' + c.status + '">' + c.status + '</span>'
      + '<span class="name">' + c.name + '</span>'
      + '<span class="detail">' + c.detail + '</span>'
      + '</div>';
  }

  html += '<h2>Common Fixes</h2>'
    + '<ul>'
    + '<li><b>Blank page after deploy?</b> Open browser DevTools (F12) → Console tab to see JavaScript errors.</li>'
    + '<li><b>"Script function not found: doGet"?</b> Create a <b>New Deployment</b> (not re-test old). Select type: Web app.</li>'
    + '<li><b>Old version showing?</b> Each deployment is versioned. Edit deployment → pick latest version, or create New Deployment.</li>'
    + '<li><b>Access denied?</b> In Deploy → Manage deployments → edit: set "Who has access" to "Anyone" (or "Anyone within [org]").</li>'
    + '<li><b>Execute as "Me" vs "User"?</b> Use "Me" so the web app runs with your spreadsheet permissions.</li>'
    + '<li><b>index.html FAIL?</b> Run <code>cd web && npm install && npm run bundle:deploy</code> to rebuild the React app.</li>'
    + '</ul>'
    + '<a class="btn" href="?' + '">Launch Web App (remove debug) &rarr;</a>'
    + '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('Parish Scheduler - Deployment Diagnostics')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

async function apiListener(e){let t=null;try{t=JSON.parse(e);const o={body:"",status:200,headers:[]};if(!paths__[t.path])throw new Error(`Path "${t.path}" does not exist`);const a=mwBefore__.length;for(let e=0;e<a;e++)await mwBefore__[e](t,o);const r=await paths__[t.path](t,o);o.body=o.body||r;for(let e=0;e<mwAfter__.length;e++)await mwAfter__[e](t,o);return o}catch(e){return console.error(e),{error:e&&e.message?e.message:e,status:500,body:""}}}(()=>{"use strict";var e=(e,t)=>{paths__[e]=t};e("getSheetData",e=>CRUD_getSheetData(e.body.sheetName)),e("addRow",e=>CRUD_addRow(e.body.sheetName,e.body.rowData)),e("updateRow",e=>CRUD_updateRow(e.body.sheetName,e.body.rowIndex,e.body.rowData)),e("deleteRow",e=>CRUD_deleteRow(e.body.sheetName,e.body.rowIndex)),e("getAllowedSheets",()=>CRUD_getAllowedSheets())})();