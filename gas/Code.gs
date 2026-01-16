/**
 * Code.gs - Web App 主進入點
 *
 * 處理所有 HTTP 請求：
 * - GET: 查詢操作
 * - POST: 寫入/更新操作
 *
 * 部署設定：
 * - Execute as: User accessing the app
 * - Who has access: Anyone
 */

// ============================================
// HTTP 請求處理
// ============================================

/**
 * 處理 GET 請求
 * @param {Object} e - 請求事件物件
 * @returns {TextOutput} JSON 回應
 */
function doGet(e) {
  var params = e.parameter || {};
  var action = params.action || 'query';

  Logger.log('GET 請求: action=' + action);

  var result;

  try {
    switch (action) {
      // ========== 公開 API ==========

      case 'query':
        // 訂單查詢 (公開)
        result = handleQuery(params.email, params.order_id);
        break;

      // ========== 管理員 API ==========

      case 'auth':
        // 驗證管理員身份
        result = {
          status: API_RESPONSE.SUCCESS,
          data: verifyAdmin()
        };
        break;

      case 'list':
        // 訂單列表
        result = handleListOrders({
          sheetName: params.sheet,
          status: params.status,
          search: params.search,
          page: parseInt(params.page) || 1,
          pageSize: parseInt(params.page_size) || PAGINATION.DEFAULT_PAGE_SIZE
        });
        break;

      case 'detail':
        // 訂單詳情
        result = handleGetOrderDetail(params.order_id);
        break;

      case 'stats':
        // 統計資訊
        result = handleGetStats();
        break;

      // ========== 預設 ==========

      default:
        result = {
          status: API_RESPONSE.ERROR,
          code: ERROR_CODES.INVALID_REQUEST,
          message: '未知的操作: ' + action
        };
    }
  } catch (error) {
    Logger.log('GET 錯誤: ' + error.message);
    result = handleError(error);
  }

  return createJsonResponse(result);
}

/**
 * 處理 POST 請求
 * @param {Object} e - 請求事件物件
 * @returns {TextOutput} JSON 回應
 */
function doPost(e) {
  var params = e.parameter || {};
  var action = params.action;

  // 解析 POST body
  var postData = {};
  try {
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }
  } catch (parseError) {
    Logger.log('JSON 解析錯誤: ' + parseError.message);
  }

  // 合併 URL 參數和 POST body
  var data = Object.assign({}, params, postData);
  action = action || data.action;

  Logger.log('POST 請求: action=' + action);

  var result;

  try {
    switch (action) {
      case 'update':
        // 更新訂單
        result = handleUpdateOrder(data.order_id, {
          status: data.status,
          notes: data.notes
        });
        break;

      default:
        result = {
          status: API_RESPONSE.ERROR,
          code: ERROR_CODES.INVALID_REQUEST,
          message: '未知的操作: ' + action
        };
    }
  } catch (error) {
    Logger.log('POST 錯誤: ' + error.message);
    result = handleError(error);
  }

  return createJsonResponse(result);
}

// ============================================
// 回應工具函數
// ============================================

/**
 * 建立 JSON 回應
 * @param {Object} data - 回應資料
 * @returns {TextOutput} JSON 回應物件
 */
function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * 處理錯誤
 * @param {Error} error - 錯誤物件
 * @returns {Object} 錯誤回應
 */
function handleError(error) {
  var message = error.message || '未知錯誤';

  // 檢查是否為授權錯誤
  if (message.indexOf('UNAUTHORIZED') !== -1) {
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.UNAUTHORIZED,
      message: '您沒有權限執行此操作'
    };
  }

  return {
    status: API_RESPONSE.ERROR,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: message
  };
}

// ============================================
// 初始化函數
// ============================================

/**
 * 初始化系統
 * 首次部署時執行，建立必要的 Sheet 結構
 */
function initializeSystem() {
  Logger.log('=== 系統初始化開始 ===');

  var spreadsheet = getSpreadsheet();

  // 建立移民申請 Sheet
  var immigrationSheet = spreadsheet.getSheetByName(SHEET_NAMES.IMMIGRATION);
  if (!immigrationSheet) {
    immigrationSheet = spreadsheet.insertSheet(SHEET_NAMES.IMMIGRATION);
    immigrationSheet.appendRow(COLUMN_HEADERS);
    Logger.log('已建立 Sheet: ' + SHEET_NAMES.IMMIGRATION);
  }

  // 建立護照申請 Sheet
  var passportSheet = spreadsheet.getSheetByName(SHEET_NAMES.PASSPORT);
  if (!passportSheet) {
    passportSheet = spreadsheet.insertSheet(SHEET_NAMES.PASSPORT);
    passportSheet.appendRow(COLUMN_HEADERS);
    Logger.log('已建立 Sheet: ' + SHEET_NAMES.PASSPORT);
  }

  // 建立狀態選項 Sheet
  var statusSheet = spreadsheet.getSheetByName(SHEET_NAMES.STATUS_OPTIONS);
  if (!statusSheet) {
    statusSheet = spreadsheet.insertSheet(SHEET_NAMES.STATUS_OPTIONS);
    statusSheet.appendRow(['status_code', 'status_label_zh', 'status_label_vi']);

    Object.keys(STATUS_LABELS).forEach(function(code) {
      var labels = STATUS_LABELS[code];
      statusSheet.appendRow([code, labels.zh, labels.vi]);
    });

    Logger.log('已建立 Sheet: ' + SHEET_NAMES.STATUS_OPTIONS);
  }

  // 檢查 Script Properties
  Logger.log('');
  Logger.log('=== Script Properties 檢查 ===');

  var requiredProps = [
    SCRIPT_PROPERTY_KEYS.AES_KEY,
    SCRIPT_PROPERTY_KEYS.SALT,
    SCRIPT_PROPERTY_KEYS.ADMIN_EMAILS
  ];

  requiredProps.forEach(function(key) {
    var value = getScriptProperty(key);
    Logger.log(key + ': ' + (value ? '已設定' : '未設定 ⚠️'));
  });

  Logger.log('');
  Logger.log('如需設定，請前往:');
  Logger.log('Project Settings > Script Properties');
  Logger.log('');
  Logger.log('=== 系統初始化完成 ===');
}

/**
 * 設定觸發器
 * 執行此函數來自動設定所需的觸發器
 */
function setupTriggers() {
  Logger.log('=== 設定觸發器 ===');

  // 先清除現有觸發器 (避免重複)
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
    Logger.log('已刪除觸發器: ' + trigger.getHandlerFunction());
  });

  // 設定 Sheet 編輯觸發器
  var spreadsheet = getSpreadsheet();
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();
  Logger.log('已設定 onSheetEdit 觸發器');

  Logger.log('');
  Logger.log('注意: Google Form 觸發器需在 Form 中設定');
  Logger.log('請前往 Google Form > 擴充功能 > Apps Script > 觸發器');
  Logger.log('新增 onFormSubmit 觸發器 (On form submit)');
  Logger.log('');
  Logger.log('=== 觸發器設定完成 ===');
}

// ============================================
// 除錯與測試
// ============================================

/**
 * 測試所有模組
 */
function runAllTests() {
  Logger.log('========================================');
  Logger.log('開始執行所有測試');
  Logger.log('========================================');
  Logger.log('');

  // 測試 CryptoJS
  Logger.log('>>> 測試 CryptoJS');
  try {
    testCryptoJS();
  } catch (e) {
    Logger.log('CryptoJS 測試失敗: ' + e.message);
  }
  Logger.log('');

  // 測試 UUID
  Logger.log('>>> 測試 UUID');
  testUUID();
  Logger.log('');

  // 測試加密
  Logger.log('>>> 測試加密');
  try {
    testEncryption();
  } catch (e) {
    Logger.log('加密測試失敗: ' + e.message);
  }
  Logger.log('');

  // 測試查詢
  Logger.log('>>> 測試查詢');
  testQueryHandler();
  Logger.log('');

  // 測試管理員
  Logger.log('>>> 測試管理員');
  testAdminHandler();
  Logger.log('');

  Logger.log('========================================');
  Logger.log('所有測試完成');
  Logger.log('========================================');
}

/**
 * 顯示系統狀態
 */
function showSystemStatus() {
  Logger.log('========================================');
  Logger.log('系統狀態報告');
  Logger.log('========================================');
  Logger.log('');

  // 當前用戶
  var user = Session.getActiveUser().getEmail();
  Logger.log('當前用戶: ' + user);
  Logger.log('');

  // Script Properties
  Logger.log('--- Script Properties ---');
  var props = [
    SCRIPT_PROPERTY_KEYS.AES_KEY,
    SCRIPT_PROPERTY_KEYS.SALT,
    SCRIPT_PROPERTY_KEYS.ADMIN_EMAILS,
    SCRIPT_PROPERTY_KEYS.SPREADSHEET_ID,
    SCRIPT_PROPERTY_KEYS.ROOT_FOLDER_ID,
    SCRIPT_PROPERTY_KEYS.QUERY_PAGE_URL,
    SCRIPT_PROPERTY_KEYS.COMPANY_PHONE,
    SCRIPT_PROPERTY_KEYS.COMPANY_EMAIL
  ];

  props.forEach(function(key) {
    var value = getScriptProperty(key);
    var display = value ? '已設定' : '未設定';
    if (value && key === SCRIPT_PROPERTY_KEYS.ADMIN_EMAILS) {
      display = value; // 顯示實際值
    }
    Logger.log(key + ': ' + display);
  });
  Logger.log('');

  // Sheets
  Logger.log('--- Sheets ---');
  var spreadsheet = getSpreadsheet();
  Logger.log('Spreadsheet ID: ' + spreadsheet.getId());
  Logger.log('Spreadsheet URL: ' + spreadsheet.getUrl());

  var sheets = spreadsheet.getSheets();
  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    var rows = sheet.getLastRow();
    Logger.log(name + ': ' + rows + ' 列');
  });
  Logger.log('');

  // 觸發器
  Logger.log('--- 觸發器 ---');
  var triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    Logger.log('無觸發器');
  } else {
    triggers.forEach(function(trigger) {
      Logger.log(trigger.getHandlerFunction() + ' (' + trigger.getEventType() + ')');
    });
  }

  Logger.log('');
  Logger.log('========================================');
}
