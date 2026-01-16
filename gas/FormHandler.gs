/**
 * FormHandler.gs - 表單提交處理
 *
 * 處理 Google Form 提交的資料：
 * 1. 生成 order_id
 * 2. 計算 verification_hash
 * 3. 加密敏感欄位
 * 4. 建立 Drive 資料夾
 * 5. 寫入 Sheet
 * 6. 發送通知郵件
 */

// ============================================
// 表單提交觸發器
// ============================================

/**
 * Google Form 提交觸發函數
 * 設定方式：Triggers > Add Trigger > onFormSubmit > From form > On form submit
 *
 * @param {Object} e - 表單提交事件物件
 */
function onFormSubmit(e) {
  try {
    Logger.log('=== 表單提交處理開始 ===');

    // 取得表單回應
    var formResponse = e.response;
    var itemResponses = formResponse.getItemResponses();

    // 解析表單資料
    var formData = parseFormResponse(itemResponses);
    Logger.log('表單資料解析完成');

    // 判斷服務類型，決定寫入哪個 Sheet
    var sheetName = determineSheetName(formData.serviceType);
    Logger.log('目標 Sheet: ' + sheetName);

    // 生成 order_id
    var orderId = generateUUID();
    Logger.log('生成 Order ID: ' + orderId);

    // 計算驗證 hash
    var verificationHash = hashForVerification(formData.customerEmail, orderId);
    Logger.log('生成驗證 Hash');

    // 加密敏感資料
    var encryptedIdNumber = encrypt(formData.idNumber || '');
    var encryptedPassportNumber = encrypt(formData.passportNumber || '');
    Logger.log('敏感資料加密完成');

    // 建立 Drive 資料夾
    var driveFolderUrl = createOrderFolder(orderId, sheetName);
    Logger.log('Drive 資料夾: ' + driveFolderUrl);

    // 處理上傳的檔案
    if (formData.uploadedFiles && formData.uploadedFiles.length > 0) {
      moveFilesToFolder(formData.uploadedFiles, driveFolderUrl);
    }

    // 準備寫入 Sheet 的資料
    var now = new Date();
    var rowData = [
      orderId,                    // A: order_id
      verificationHash,           // B: verification_hash
      now,                        // C: created_at
      now,                        // D: updated_at
      ORDER_STATUS.PENDING,       // E: status
      formData.serviceType,       // F: service_type
      formData.customerName,      // G: customer_name
      formData.customerEmail,     // H: customer_email
      formData.customerPhone,     // I: customer_phone
      encryptedIdNumber,          // J: id_number_encrypted
      encryptedPassportNumber,    // K: passport_number_encrypted
      formData.notes || '',       // L: notes
      driveFolderUrl              // M: drive_folder_url
    ];

    // 寫入 Sheet
    var sheet = getSheet(sheetName);
    sheet.appendRow(rowData);
    Logger.log('資料已寫入 Sheet');

    // 準備訂單資料物件
    var orderData = {
      orderId: orderId,
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      serviceType: formData.serviceType,
      createdAt: now,
      driveFolderUrl: driveFolderUrl
    };

    // 發送確認信給客戶
    sendOrderConfirmation(orderData);

    // 發送通知給管理員
    sendAdminNotification(orderData);

    Logger.log('=== 表單提交處理完成 ===');

  } catch (error) {
    Logger.log('表單處理錯誤: ' + error.message);
    Logger.log('Stack: ' + error.stack);

    // 嘗試發送錯誤通知給管理員
    notifyError('表單處理失敗', error);
  }
}

// ============================================
// Sheet 編輯觸發器 (狀態更新)
// ============================================

/**
 * Sheet 編輯觸發函數
 * 設定方式：Triggers > Add Trigger > onEdit > From spreadsheet > On edit
 *
 * @param {Object} e - 編輯事件物件
 */
function onSheetEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();
    var sheetName = sheet.getName();

    // 只處理訂單相關的 Sheet
    if (sheetName !== SHEET_NAMES.IMMIGRATION && sheetName !== SHEET_NAMES.PASSPORT) {
      return;
    }

    var range = e.range;
    var column = range.getColumn();

    // 只處理狀態欄位 (E 欄 = 第 5 欄)
    if (column !== COLUMN_INDEX.STATUS + 1) {
      return;
    }

    var row = range.getRow();

    // 忽略標題列
    if (row === 1) {
      return;
    }

    var newStatus = e.value;
    var oldStatus = e.oldValue;

    // 如果狀態沒變，不處理
    if (newStatus === oldStatus) {
      return;
    }

    Logger.log('狀態變更: ' + oldStatus + ' -> ' + newStatus);

    // 取得該列的資料
    var rowData = sheet.getRange(row, 1, 1, COLUMN_HEADERS.length).getValues()[0];

    var orderData = {
      orderId: rowData[COLUMN_INDEX.ORDER_ID],
      customerName: rowData[COLUMN_INDEX.CUSTOMER_NAME],
      customerEmail: rowData[COLUMN_INDEX.CUSTOMER_EMAIL]
    };

    // 更新 updated_at
    var now = new Date();
    sheet.getRange(row, COLUMN_INDEX.UPDATED_AT + 1).setValue(now);

    // 發送狀態更新通知
    sendStatusUpdate(orderData, newStatus, now);

    Logger.log('狀態更新處理完成');

  } catch (error) {
    Logger.log('狀態更新處理錯誤: ' + error.message);
  }
}

// ============================================
// 輔助函數
// ============================================

/**
 * 解析表單回應
 * @param {Array} itemResponses - 表單項目回應陣列
 * @returns {Object} 解析後的表單資料
 */
function parseFormResponse(itemResponses) {
  var data = {};

  itemResponses.forEach(function(itemResponse) {
    var title = itemResponse.getItem().getTitle();
    var response = itemResponse.getResponse();

    // 根據欄位對應表解析
    var fieldName = FORM_FIELD_MAP[title];

    if (fieldName) {
      data[fieldName] = response;
    } else if (title.indexOf('上傳') !== -1 || title.indexOf('文件') !== -1) {
      // 處理檔案上傳
      data.uploadedFiles = response;
    }
  });

  return data;
}

/**
 * 決定目標 Sheet 名稱
 * @param {string} serviceType - 服務類型
 * @returns {string} Sheet 名稱
 */
function determineSheetName(serviceType) {
  if (serviceType && serviceType.indexOf('護照') !== -1) {
    return SHEET_NAMES.PASSPORT;
  }
  return SHEET_NAMES.IMMIGRATION;
}

/**
 * 建立訂單資料夾
 * @param {string} orderId - 訂單 ID
 * @param {string} serviceType - 服務類型 (用於決定父資料夾)
 * @returns {string} 資料夾 URL
 */
function createOrderFolder(orderId, sheetName) {
  var rootFolderId = getScriptProperty(SCRIPT_PROPERTY_KEYS.ROOT_FOLDER_ID);

  var rootFolder;
  if (rootFolderId) {
    rootFolder = DriveApp.getFolderById(rootFolderId);
  } else {
    // 如果沒設定，在根目錄建立
    var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAMES.ROOT);
    if (folders.hasNext()) {
      rootFolder = folders.next();
    } else {
      rootFolder = DriveApp.createFolder(DRIVE_FOLDER_NAMES.ROOT);
    }
  }

  // 決定子資料夾 (Immigration 或 Passport)
  var subFolderName = sheetName === SHEET_NAMES.PASSPORT
    ? DRIVE_FOLDER_NAMES.PASSPORT
    : DRIVE_FOLDER_NAMES.IMMIGRATION;

  var subFolders = rootFolder.getFoldersByName(subFolderName);
  var subFolder = subFolders.hasNext()
    ? subFolders.next()
    : rootFolder.createFolder(subFolderName);

  // 建立訂單資料夾
  var orderFolder = subFolder.createFolder(orderId);

  return orderFolder.getUrl();
}

/**
 * 移動上傳的檔案到訂單資料夾
 * @param {Array} fileIds - 檔案 ID 陣列
 * @param {string} folderUrl - 目標資料夾 URL
 */
function moveFilesToFolder(fileIds, folderUrl) {
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    return;
  }

  try {
    // 從 URL 取得資料夾
    var folderId = extractFolderIdFromUrl(folderUrl);
    var folder = DriveApp.getFolderById(folderId);

    fileIds.forEach(function(fileId) {
      try {
        var file = DriveApp.getFileById(fileId);
        file.moveTo(folder);
        Logger.log('檔案已移動: ' + file.getName());
      } catch (e) {
        Logger.log('移動檔案失敗: ' + e.message);
      }
    });
  } catch (e) {
    Logger.log('處理檔案移動時發生錯誤: ' + e.message);
  }
}

/**
 * 從 Drive URL 提取資料夾 ID
 * @param {string} url - Drive 資料夾 URL
 * @returns {string} 資料夾 ID
 */
function extractFolderIdFromUrl(url) {
  var match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * 發送錯誤通知給管理員
 * @param {string} title - 錯誤標題
 * @param {Error} error - 錯誤物件
 */
function notifyError(title, error) {
  var adminEmails = getScriptProperty(SCRIPT_PROPERTY_KEYS.ADMIN_EMAILS);
  if (!adminEmails) {
    return;
  }

  var subject = '【系統錯誤】' + title;
  var body = '發生時間：' + new Date().toISOString() + '\n\n' +
    '錯誤訊息：' + error.message + '\n\n' +
    'Stack Trace：\n' + error.stack;

  try {
    GmailApp.sendEmail(adminEmails.split(',')[0].trim(), subject, body);
  } catch (e) {
    Logger.log('無法發送錯誤通知: ' + e.message);
  }
}

// ============================================
// 測試函數
// ============================================

/**
 * 測試表單處理 (模擬提交)
 */
function testFormHandler() {
  Logger.log('=== 表單處理測試 ===');

  // 模擬表單資料
  var mockFormData = {
    customerName: '測試用戶',
    customerEmail: Session.getActiveUser().getEmail(),
    customerPhone: '0912-345-678',
    serviceType: '移民申請 - 投資移民',
    idNumber: 'A123456789',
    passportNumber: '123456789',
    notes: '這是測試資料'
  };

  Logger.log('模擬表單資料:');
  Logger.log(JSON.stringify(mockFormData, null, 2));

  // 測試各個步驟
  var orderId = generateUUID();
  Logger.log('生成 Order ID: ' + orderId);

  var hash = hashForVerification(mockFormData.customerEmail, orderId);
  Logger.log('驗證 Hash: ' + hash.substring(0, 20) + '...');

  var encrypted = encrypt(mockFormData.idNumber);
  Logger.log('加密後身分證: ' + encrypted.substring(0, 30) + '...');

  Logger.log('=== 測試完成 (未寫入資料) ===');
  Logger.log('如需完整測試，請透過 Google Form 提交');
}

/**
 * 手動建立測試資料
 * 注意：這會實際寫入資料到 Sheet
 */
function createTestOrder() {
  var sheet = getSheet(SHEET_NAMES.IMMIGRATION);
  if (!sheet) {
    Logger.log('找不到 Sheet: ' + SHEET_NAMES.IMMIGRATION);
    Logger.log('請先建立 Sheet 或調整 SHEET_NAMES 設定');
    return;
  }

  var orderId = generateUUID();
  var email = 'test@example.com';
  var now = new Date();

  var rowData = [
    orderId,
    hashForVerification(email, orderId),
    now,
    now,
    ORDER_STATUS.PENDING,
    '測試服務',
    '測試用戶',
    email,
    '0912-345-678',
    encrypt('A123456789'),
    encrypt(''),
    '測試備註',
    ''
  ];

  sheet.appendRow(rowData);
  Logger.log('測試訂單已建立: ' + orderId);

  return orderId;
}
