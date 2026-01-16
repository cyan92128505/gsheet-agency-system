/**
 * AdminHandler.gs - 管理員 API 處理
 *
 * 提供管理員功能：
 * 1. 訂單列表 (含篩選、分頁)
 * 2. 訂單詳情 (含解密敏感資料)
 * 3. 更新訂單狀態
 * 4. 新增/修改備註
 */

// ============================================
// 身份驗證
// ============================================

/**
 * 驗證管理員身份
 * @returns {Object} { isAdmin: boolean, email: string }
 */
function verifyAdmin() {
  var currentUser = Session.getActiveUser().getEmail();

  if (!currentUser) {
    return { isAdmin: false, email: null };
  }

  var adminEmails = getScriptProperty(SCRIPT_PROPERTY_KEYS.ADMIN_EMAILS);
  if (!adminEmails) {
    Logger.log('ADMIN_EMAILS 未設定');
    return { isAdmin: false, email: currentUser };
  }

  var adminList = adminEmails.split(',').map(function(email) {
    return email.trim().toLowerCase();
  });

  var isAdmin = adminList.indexOf(currentUser.toLowerCase()) !== -1;

  return { isAdmin: isAdmin, email: currentUser };
}

/**
 * 檢查管理員權限，未授權則拋出錯誤
 */
function requireAdmin() {
  var auth = verifyAdmin();
  if (!auth.isAdmin) {
    throw new Error('UNAUTHORIZED: 您沒有管理員權限');
  }
  return auth;
}

// ============================================
// 訂單列表
// ============================================

/**
 * 取得訂單列表
 * @param {Object} options - 查詢選項
 * @param {string} options.sheetName - Sheet 名稱 (可選，預設搜尋全部)
 * @param {string} options.status - 狀態篩選 (可選)
 * @param {string} options.search - 搜尋關鍵字 (可選)
 * @param {number} options.page - 頁碼 (1-based，預設 1)
 * @param {number} options.pageSize - 每頁筆數 (預設 20)
 * @returns {Object} 訂單列表結果
 */
function handleListOrders(options) {
  requireAdmin();

  options = options || {};
  var page = Math.max(1, options.page || 1);
  var pageSize = Math.min(
    PAGINATION.MAX_PAGE_SIZE,
    Math.max(1, options.pageSize || PAGINATION.DEFAULT_PAGE_SIZE)
  );

  try {
    var allOrders = [];

    // 收集訂單
    var sheetsToSearch = options.sheetName
      ? [options.sheetName]
      : [SHEET_NAMES.IMMIGRATION, SHEET_NAMES.PASSPORT];

    sheetsToSearch.forEach(function(sheetName) {
      var orders = getOrdersFromSheet(sheetName);
      allOrders = allOrders.concat(orders);
    });

    // 篩選狀態
    if (options.status) {
      allOrders = allOrders.filter(function(order) {
        return order.status === options.status;
      });
    }

    // 搜尋
    if (options.search) {
      var searchLower = options.search.toLowerCase();
      allOrders = allOrders.filter(function(order) {
        return order.orderId.toLowerCase().indexOf(searchLower) !== -1 ||
          order.customerName.toLowerCase().indexOf(searchLower) !== -1 ||
          order.customerEmail.toLowerCase().indexOf(searchLower) !== -1;
      });
    }

    // 按建立時間倒序排列
    allOrders.sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // 計算分頁
    var totalCount = allOrders.length;
    var totalPages = Math.ceil(totalCount / pageSize);
    var startIndex = (page - 1) * pageSize;
    var endIndex = startIndex + pageSize;
    var pagedOrders = allOrders.slice(startIndex, endIndex);

    // 轉換為安全的列表格式 (不包含敏感資料)
    var safeOrders = pagedOrders.map(function(order) {
      return {
        orderId: order.orderId,
        status: order.status,
        statusLabel: getStatusLabel(order.status),
        serviceType: order.serviceType,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        createdAt: formatDateTime(order.createdAt),
        updatedAt: formatDateTime(order.updatedAt),
        sheetName: order.sheetName
      };
    });

    return {
      status: API_RESPONSE.SUCCESS,
      data: {
        orders: safeOrders,
        pagination: {
          page: page,
          pageSize: pageSize,
          totalCount: totalCount,
          totalPages: totalPages
        }
      }
    };

  } catch (error) {
    Logger.log('列表查詢錯誤: ' + error.message);
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error.message
    };
  }
}

/**
 * 從 Sheet 取得訂單列表
 * @param {string} sheetName - Sheet 名稱
 * @returns {Array} 訂單陣列
 */
function getOrdersFromSheet(sheetName) {
  var sheet = getSheet(sheetName);
  if (!sheet) {
    return [];
  }

  var data = sheet.getDataRange().getValues();
  var orders = [];

  // 跳過標題列
  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    // 確保有資料
    if (!row[COLUMN_INDEX.ORDER_ID]) {
      continue;
    }

    orders.push({
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
      rowIndex: i + 1
    });
  }

  return orders;
}

// ============================================
// 訂單詳情
// ============================================

/**
 * 取得訂單詳情 (含解密)
 * @param {string} orderId - 訂單 ID
 * @returns {Object} 訂單詳情
 */
function handleGetOrderDetail(orderId) {
  requireAdmin();

  if (!orderId) {
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.INVALID_REQUEST,
      message: '請提供訂單編號'
    };
  }

  try {
    var order = findOrderById(orderId);

    if (!order) {
      return {
        status: API_RESPONSE.ERROR,
        code: ERROR_CODES.ORDER_NOT_FOUND,
        message: '查無此訂單'
      };
    }

    // 解密敏感資料
    var decryptedIdNumber = '';
    var decryptedPassportNumber = '';

    try {
      if (order.idNumberEncrypted) {
        decryptedIdNumber = decrypt(order.idNumberEncrypted);
      }
      if (order.passportNumberEncrypted) {
        decryptedPassportNumber = decrypt(order.passportNumberEncrypted);
      }
    } catch (e) {
      Logger.log('解密失敗: ' + e.message);
    }

    return {
      status: API_RESPONSE.SUCCESS,
      data: {
        orderId: order.orderId,
        status: order.status,
        statusLabel: getStatusLabel(order.status),
        serviceType: order.serviceType,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        idNumber: decryptedIdNumber,
        passportNumber: decryptedPassportNumber,
        notes: order.notes,
        driveFolderUrl: order.driveFolderUrl,
        createdAt: formatDateTime(order.createdAt),
        updatedAt: formatDateTime(order.updatedAt),
        sheetName: order.sheetName
      }
    };

  } catch (error) {
    Logger.log('詳情查詢錯誤: ' + error.message);
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error.message
    };
  }
}

// ============================================
// 更新訂單
// ============================================

/**
 * 更新訂單
 * @param {string} orderId - 訂單 ID
 * @param {Object} updates - 更新內容
 * @param {string} updates.status - 新狀態 (可選)
 * @param {string} updates.notes - 新備註 (可選)
 * @returns {Object} 更新結果
 */
function handleUpdateOrder(orderId, updates) {
  requireAdmin();

  if (!orderId) {
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.INVALID_REQUEST,
      message: '請提供訂單編號'
    };
  }

  if (!updates || (updates.status === undefined && updates.notes === undefined)) {
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.INVALID_REQUEST,
      message: '請提供要更新的內容'
    };
  }

  try {
    var order = findOrderById(orderId);

    if (!order) {
      return {
        status: API_RESPONSE.ERROR,
        code: ERROR_CODES.ORDER_NOT_FOUND,
        message: '查無此訂單'
      };
    }

    var sheet = getSheet(order.sheetName);
    var now = new Date();
    var statusChanged = false;

    // 更新狀態
    if (updates.status !== undefined && updates.status !== order.status) {
      // 驗證狀態值
      if (!ORDER_STATUS[updates.status.toUpperCase()] &&
          !Object.values(ORDER_STATUS).includes(updates.status)) {
        return {
          status: API_RESPONSE.ERROR,
          code: ERROR_CODES.INVALID_REQUEST,
          message: '無效的狀態值'
        };
      }

      sheet.getRange(order.rowIndex, COLUMN_INDEX.STATUS + 1).setValue(updates.status);
      statusChanged = true;
    }

    // 更新備註
    if (updates.notes !== undefined) {
      sheet.getRange(order.rowIndex, COLUMN_INDEX.NOTES + 1).setValue(updates.notes);
    }

    // 更新 updated_at
    sheet.getRange(order.rowIndex, COLUMN_INDEX.UPDATED_AT + 1).setValue(now);

    // 如果狀態變更，發送通知
    if (statusChanged) {
      sendStatusUpdate({
        orderId: order.orderId,
        customerName: order.customerName,
        customerEmail: order.customerEmail
      }, updates.status, now);
    }

    return {
      status: API_RESPONSE.SUCCESS,
      message: '訂單已更新',
      data: {
        orderId: orderId,
        updatedAt: formatDateTime(now),
        statusChanged: statusChanged
      }
    };

  } catch (error) {
    Logger.log('更新錯誤: ' + error.message);
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error.message
    };
  }
}

// ============================================
// 統計資訊
// ============================================

/**
 * 取得訂單統計
 * @returns {Object} 統計資訊
 */
function handleGetStats() {
  requireAdmin();

  try {
    var stats = {
      total: 0,
      byStatus: {},
      byServiceType: {}
    };

    // 初始化狀態計數
    Object.values(ORDER_STATUS).forEach(function(status) {
      stats.byStatus[status] = 0;
    });

    // 統計兩個 Sheet
    [SHEET_NAMES.IMMIGRATION, SHEET_NAMES.PASSPORT].forEach(function(sheetName) {
      var orders = getOrdersFromSheet(sheetName);

      orders.forEach(function(order) {
        stats.total++;

        if (stats.byStatus[order.status] !== undefined) {
          stats.byStatus[order.status]++;
        }

        if (!stats.byServiceType[order.serviceType]) {
          stats.byServiceType[order.serviceType] = 0;
        }
        stats.byServiceType[order.serviceType]++;
      });
    });

    return {
      status: API_RESPONSE.SUCCESS,
      data: stats
    };

  } catch (error) {
    Logger.log('統計錯誤: ' + error.message);
    return {
      status: API_RESPONSE.ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error.message
    };
  }
}

// ============================================
// 測試函數
// ============================================

/**
 * 測試管理員功能
 */
function testAdminHandler() {
  Logger.log('=== 管理員功能測試 ===');

  // 測試身份驗證
  var auth = verifyAdmin();
  Logger.log('當前用戶: ' + auth.email);
  Logger.log('是否為管理員: ' + auth.isAdmin);

  if (!auth.isAdmin) {
    Logger.log('您不是管理員，請先將您的 email 加入 ADMIN_EMAILS');
    Logger.log('路徑: Project Settings > Script Properties > ADMIN_EMAILS');
    return;
  }

  // 測試列表查詢
  var listResult = handleListOrders({ page: 1, pageSize: 5 });
  Logger.log('訂單列表: ' + JSON.stringify(listResult, null, 2));

  // 測試統計
  var statsResult = handleGetStats();
  Logger.log('訂單統計: ' + JSON.stringify(statsResult, null, 2));

  Logger.log('=== 測試完成 ===');
}
