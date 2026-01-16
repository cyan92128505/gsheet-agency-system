/**
 * Config.gs - 系統設定常數
 *
 * 注意：敏感資料（如 AES_KEY, SALT, ADMIN_EMAILS）
 * 請存放在 Script Properties，不要寫在程式碼中。
 */

// ============================================
// Google Sheet 設定
// ============================================

/**
 * Sheet 名稱
 */
var SHEET_NAMES = {
  IMMIGRATION: '移民申請',
  PASSPORT: '護照申請',
  STATUS_OPTIONS: '狀態選項',
  SYSTEM_CONFIG: '系統設定'
};

/**
 * Sheet 欄位索引 (0-based)
 * 對應 CLAUDE.md 中定義的欄位結構
 */
var COLUMN_INDEX = {
  ORDER_ID: 0,              // A: order_id (UUID)
  VERIFICATION_HASH: 1,     // B: verification_hash
  CREATED_AT: 2,            // C: created_at
  UPDATED_AT: 3,            // D: updated_at
  STATUS: 4,                // E: status
  SERVICE_TYPE: 5,          // F: service_type
  CUSTOMER_NAME: 6,         // G: customer_name
  CUSTOMER_EMAIL: 7,        // H: customer_email
  CUSTOMER_PHONE: 8,        // I: customer_phone
  ID_NUMBER_ENCRYPTED: 9,   // J: id_number_encrypted
  PASSPORT_NUMBER_ENCRYPTED: 10, // K: passport_number_encrypted
  NOTES: 11,                // L: notes
  DRIVE_FOLDER_URL: 12      // M: drive_folder_url
};

/**
 * 欄位名稱 (用於 header row)
 */
var COLUMN_HEADERS = [
  'order_id',
  'verification_hash',
  'created_at',
  'updated_at',
  'status',
  'service_type',
  'customer_name',
  'customer_email',
  'customer_phone',
  'id_number_encrypted',
  'passport_number_encrypted',
  'notes',
  'drive_folder_url'
];

// ============================================
// 訂單狀態
// ============================================

var ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

var STATUS_LABELS = {
  pending: { zh: '待處理', vi: 'Đang chờ xử lý' },
  processing: { zh: '處理中', vi: 'Đang xử lý' },
  completed: { zh: '已完成', vi: 'Hoàn thành' },
  cancelled: { zh: '已取消', vi: 'Đã hủy' }
};

// ============================================
// Google Drive 設定
// ============================================

/**
 * 根資料夾名稱
 * 實際部署時會在 Script Properties 設定根資料夾 ID
 */
var DRIVE_FOLDER_NAMES = {
  ROOT: 'Agency Documents',
  IMMIGRATION: 'Immigration',
  PASSPORT: 'Passport'
};

// ============================================
// Google Form 欄位對應
// ============================================

/**
 * Google Form 問題標題與內部欄位名稱的對應
 * 部署時需根據實際 Form 調整
 */
var FORM_FIELD_MAP = {
  '姓名': 'customer_name',
  'Email': 'customer_email',
  '電話': 'customer_phone',
  '服務類型': 'service_type',
  '身分證字號': 'id_number',
  '護照號碼': 'passport_number',
  '備註': 'notes'
};

// ============================================
// API 回應格式
// ============================================

var API_RESPONSE = {
  SUCCESS: 'success',
  ERROR: 'error'
};

var ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

// ============================================
// 分頁設定
// ============================================

var PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
};

// ============================================
// Script Properties Keys
// ============================================

/**
 * 這些是 Script Properties 中使用的 key 名稱
 * 實際值需在 GAS 編輯器的 Project Settings 中設定
 */
var SCRIPT_PROPERTY_KEYS = {
  AES_KEY: 'AES_KEY',
  SALT: 'SALT',
  ADMIN_EMAILS: 'ADMIN_EMAILS',
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  ROOT_FOLDER_ID: 'ROOT_FOLDER_ID',
  QUERY_PAGE_URL: 'QUERY_PAGE_URL',
  COMPANY_PHONE: 'COMPANY_PHONE',
  COMPANY_EMAIL: 'COMPANY_EMAIL'
};

// ============================================
// 工具函數
// ============================================

/**
 * 取得 Script Property
 * @param {string} key - Property key
 * @returns {string|null} Property value
 */
function getScriptProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 * 取得目標 Spreadsheet
 * @returns {Spreadsheet} Google Spreadsheet 物件
 */
function getSpreadsheet() {
  var spreadsheetId = getScriptProperty(SCRIPT_PROPERTY_KEYS.SPREADSHEET_ID);
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  // 如果沒設定 ID，使用綁定的 Spreadsheet
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * 取得指定的 Sheet
 * @param {string} sheetName - Sheet 名稱
 * @returns {Sheet} Google Sheet 物件
 */
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}
