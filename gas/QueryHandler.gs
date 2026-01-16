/**
 * QueryHandler.gs - 訂單查詢處理
 *
 * 處理客戶查詢訂單狀態的請求
 * 使用 email + order_id 進行驗證
 */

// ============================================
// 查詢處理函數
// ============================================

/**
 * 處理訂單查詢請求
 * @param {string} email - 客戶 email
 * @param {string} orderId - 訂單 ID
 * @returns {Object} 查詢結果
 */
function handleQuery(email, orderId) {
  // 參數驗證
  if (!email || !orderId) {
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.INVALID_REQUEST,
      message: '請提供 email 和訂單編號'
    };
  }

  // 驗證 UUID 格式
  if (!isValidUUID(orderId)) {
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.ORDER_NOT_FOUND,
      message: '查無此訂單'
    };
  }

  try {
    // 計算預期的 hash
    var expectedHash = hashForVerification(email, orderId);

    // 在兩個 Sheet 中搜尋
    var order = findOrderByHash(expectedHash);

    if (!order) {
      return {
        status: API_RESPONSE.ERROR,
        code: ERROR_CODES.ORDER_NOT_FOUND,
        message: '查無此訂單'
      };
    }

    // 回傳非敏感資料
    return {
      status: API_RESPONSE.SUCCESS,
      data: {
        orderId: order.orderId,
        status: order.status,
        statusLabel: getStatusLabel(order.status),
        serviceType: order.serviceType,
        createdAt: formatDateTime(order.createdAt),
        updatedAt: formatDateTime(order.updatedAt)
      }
    };

  } catch (error) {
    Logger.log('查詢錯誤: ' + error.message);
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: '系統錯誤，請稍後再試'
    };
  }
}

// ============================================
// 輔助函數
// ============================================

/**
 * 根據 hash 查找訂單
 * @param {string} hash - 驗證 hash
 * @returns {Object|null} 訂單資料或 null
 */
function findOrderByHash(hash) {
  // 搜尋移民申請 Sheet
  var order = searchSheetByHash(SHEET_NAMES.IMMIGRATION, hash);
  if (order) {
    return order;
  }

  // 搜尋護照申請 Sheet
  order = searchSheetByHash(SHEET_NAMES.PASSPORT, hash);
  return order;
}

/**
 * 在指定 Sheet 中搜尋 hash
 * @param {string} sheetName - Sheet 名稱
 * @param {string} hash - 驗證 hash
 * @returns {Object|null} 訂單資料或 null
 */
function searchSheetByHash(sheetName, hash) {
  var sheet = getSheet(sheetName);
  if (!sheet) {
    return null;
  }

  var data = sheet.getDataRange().getValues();

  // 跳過標題列
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var storedHash = row[COLUMN_INDEX.VERIFICATION_HASH];

    if (storedHash === hash) {
      return {
        orderId: row[COLUMN_INDEX.ORDER_ID],
        status: row[COLUMN_INDEX.STATUS],
        serviceType: row[COLUMN_INDEX.SERVICE_TYPE],
        createdAt: row[COLUMN_INDEX.CREATED_AT],
        updatedAt: row[COLUMN_INDEX.UPDATED_AT],
        sheetName: sheetName,
        rowIndex: i + 1 // 1-based row number
      };
    }
  }

  return null;
}

/**
 * 根據 order_id 查找訂單 (內部使用)
 * @param {string} orderId - 訂單 ID
 * @returns {Object|null} 訂單資料或 null
 */
function findOrderById(orderId) {
  // 搜尋移民申請 Sheet
  var order = searchSheetById(SHEET_NAMES.IMMIGRATION, orderId);
  if (order) {
    return order;
  }

  // 搜尋護照申請 Sheet
  order = searchSheetById(SHEET_NAMES.PASSPORT, orderId);
  return order;
}

/**
 * 在指定 Sheet 中搜尋 order_id
 * @param {string} sheetName - Sheet 名稱
 * @param {string} orderId - 訂單 ID
 * @returns {Object|null} 完整訂單資料或 null
 */
function searchSheetById(sheetName, orderId) {
  var sheet = getSheet(sheetName);
  if (!sheet) {
    return null;
  }

  var data = sheet.getDataRange().getValues();

  // 跳過標題列
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var storedOrderId = row[COLUMN_INDEX.ORDER_ID];

    if (storedOrderId === orderId) {
      return {
        orderId: row[COLUMN_INDEX.ORDER_ID],
        verificationHash: row[COLUMN_INDEX.VERIFICATION_HASH],
        createdAt: row[COLUMN_INDEX.CREATED_AT],
        updatedAt: row[COLUMN_INDEX.UPDATED_AT],
        status: row[COLUMN_INDEX.STATUS],
        serviceType: row[COLUMN_INDEX.SERVICE_TYPE],
        customerName: row[COLUMN_INDEX.CUSTOMER_NAME],
        customerEmail: row[COLUMN_INDEX.CUSTOMER_EMAIL],
        customerPhone: row[COLUMN_INDEX.CUSTOMER_PHONE],
        idNumberEncrypted: row[COLUMN_INDEX.ID_NUMBER_ENCRYPTED],
        passportNumberEncrypted: row[COLUMN_INDEX.PASSPORT_NUMBER_ENCRYPTED],
        notes: row[COLUMN_INDEX.NOTES],
        driveFolderUrl: row[COLUMN_INDEX.DRIVE_FOLDER_URL],
        sheetName: sheetName,
        rowIndex: i + 1 // 1-based row number
      };
    }
  }

  return null;
}

/**
 * 取得狀態標籤
 * @param {string} status - 狀態代碼
 * @returns {Object} 狀態標籤 { zh, vi }
 */
function getStatusLabel(status) {
  return STATUS_LABELS[status] || { zh: status, vi: status };
}

// ============================================
// 測試函數
// ============================================

/**
 * 測試訂單查詢
 */
function testQueryHandler() {
  Logger.log('=== 訂單查詢測試 ===');

  // 先建立一個測試訂單
  var testEmail = 'test@example.com';
  var testOrderId = generateUUID();

  // 計算 hash
  var hash = hashForVerification(testEmail, testOrderId);
  Logger.log('測試 Email: ' + testEmail);
  Logger.log('測試 Order ID: ' + testOrderId);
  Logger.log('驗證 Hash: ' + hash.substring(0, 20) + '...');

  // 測試查詢 (假設資料庫中沒有這筆資料)
  var result = handleQuery(testEmail, testOrderId);
  Logger.log('查詢結果: ' + JSON.stringify(result, null, 2));

  // 測試無效參數
  var invalidResult = handleQuery('', '');
  Logger.log('無效參數結果: ' + JSON.stringify(invalidResult));

  // 測試無效 UUID
  var invalidUuidResult = handleQuery(testEmail, 'not-a-valid-uuid');
  Logger.log('無效 UUID 結果: ' + JSON.stringify(invalidUuidResult));

  Logger.log('=== 測試完成 ===');
}
