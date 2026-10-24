/**
 * Oakcraft Expense Manager — Backend API (Google Apps Script)
 * File: Config.gs
 *
 * Central configuration and sheet/column maps.
 * The column maps mirror the EXACT headers already present in the
 * spreadsheet. Nothing here renames, reorders, or removes a column.
 *
 * IMPORTANT: set SPREADSHEET_ID below to your sheet's ID, or leave blank
 * to bind to the container spreadsheet when this script is bound to it.
 */

// If the script is standalone, paste the spreadsheet ID here.
// (The ID is the long token in the sheet URL between /d/ and /edit.)
var SPREADSHEET_ID = '1agh1tzPAM14b7mBUfAhzZIHjVH0YLo4rE-vcfZmJIqk';

// A shared secret you set once. The web/app clients send it with every
// request. Change it after first deploy and update web/js/config.js to match.
var API_SHARED_KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

// Folder (by name) under which uploaded proof images are stored in Drive.
var UPLOAD_FOLDER_NAME = 'Expense_Sheet_Images';

// Sheet (tab) names — must match the workbook exactly.
var SHEETS = {
  TX:        'Transactions',
  EMP:       'Employee_Master',
  CAT:       'Category_Master',
  APR:       'Approver_Master',
  RCV:       'Receiver_Master',
  USR:       'User_Master',
  SET:       'Settings',
  AUDIT:     'Audit_Log',
  COUNTERS:  'Counters'
};

// Exact header order for Transactions (A..W). Used to read/write by name.
var TX_COLS = [
  'Transaction ID','Timestamp','Expense Date','Type of Transaction',
  'Amount Recv By','Expense Category','Customer Name','Employee Name',
  'Payment Method','Amount','Approved By','Bill / Payment Proof',
  'Expense Reference Proof','Purpose / Remarks','Status','Entered By',
  'User Email','Record Status','Updated At','Updated By','Deleted By',
  'Deleted At','Delete Reason'
];

var EMP_COLS = ['Employee ID','Name','Department','Designation','Mobile','Email','Active','Approval Limit','Remarks'];
var CAT_COLS = ['Category ID','Category Name','Type','Active','Display Order','Needs Customer','Description'];
var APR_COLS = ['Approver ID','Name','Email','Level','Active'];
var RCV_COLS = ['Receiver ID','Name','Active','Display Order'];
var USR_COLS = ['User ID','Name','Email','Mobile','Role','Department','Password Hash','Active',
  'Can Add','Can Edit','Can Delete','Can Approve','Can Export','Can View Dashboard','Can Manage Masters','Last Login'];
var SET_COLS = ['Key','Value','Type','Group','Description'];
var AUDIT_COLS = ['At','User Email','User Name','Action','Entity','Record ID','Details','IP','Source'];

// Fixed dropdown domains reproduced from the AppSheet app.
var TX_TYPES = ['PAYMENT PAID','PAYMENT RECV','RECV FROM EMPLOYEE'];
var PAYMENT_METHODS = ['ONLINE TRANSACTION','CASH'];
var RECORD_STATUS = { ACTIVE: 'Active', DELETED: 'Deleted' };

var SS_HANDLE_ = null;
function ss_() {
  if (SS_HANDLE_) return SS_HANDLE_;
  SS_HANDLE_ = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  return SS_HANDLE_;
}
function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}
