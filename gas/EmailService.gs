/**
 * EmailService.gs - 郵件發送服務
 *
 * 負責發送：
 * 1. 訂單確認信 (給客戶)
 * 2. 狀態更新通知 (給客戶)
 * 3. 新訂單通知 (給管理員)
 */

// ============================================
// 郵件發送函數
// ============================================

/**
 * 發送訂單確認信給客戶
 * @param {Object} orderData - 訂單資料
 * @param {string} orderData.orderId - 訂單 ID
 * @param {string} orderData.customerName - 客戶姓名
 * @param {string} orderData.customerEmail - 客戶 Email
 * @param {string} orderData.serviceType - 服務類型
 * @param {Date} orderData.createdAt - 建立時間
 */
function sendOrderConfirmation(orderData) {
  var queryPageUrl = getScriptProperty(SCRIPT_PROPERTY_KEYS.QUERY_PAGE_URL) || '[查詢頁面網址]';
  var companyPhone = getScriptProperty(SCRIPT_PROPERTY_KEYS.COMPANY_PHONE) || '[公司電話]';
  var companyEmail = getScriptProperty(SCRIPT_PROPERTY_KEYS.COMPANY_EMAIL) || '[公司Email]';

  var subject = '【訂單確認】您的申請已收到 - 訂單編號 ' + orderData.orderId;

  var body = orderData.customerName + ' 您好，\n\n' +
    '感謝您使用我們的服務，您的申請已成功送出。\n\n' +
    '訂單編號：' + orderData.orderId + '\n' +
    '服務類型：' + orderData.serviceType + '\n' +
    '申請時間：' + formatDateTime(orderData.createdAt) + '\n\n' +
    '請保留此訂單編號，您可以在我們的網站查詢申請進度。\n' +
    '查詢網址：' + queryPageUrl + '\n\n' +
    '如有任何問題，請聯繫我們：\n' +
    '電話：' + companyPhone + '\n' +
    'Email：' + companyEmail + '\n\n' +
    '此為系統自動發送，請勿直接回覆。';

  try {
    GmailApp.sendEmail(orderData.customerEmail, subject, body);
    Logger.log('訂單確認信已發送至: ' + orderData.customerEmail);
    return true;
  } catch (e) {
    Logger.log('發送訂單確認信失敗: ' + e.message);
    return false;
  }
}

/**
 * 發送狀態更新通知給客戶
 * @param {Object} orderData - 訂單資料
 * @param {string} orderData.orderId - 訂單 ID
 * @param {string} orderData.customerName - 客戶姓名
 * @param {string} orderData.customerEmail - 客戶 Email
 * @param {string} newStatus - 新狀態代碼
 * @param {Date} updatedAt - 更新時間
 */
function sendStatusUpdate(orderData, newStatus, updatedAt) {
  var queryPageUrl = getScriptProperty(SCRIPT_PROPERTY_KEYS.QUERY_PAGE_URL) || '[查詢頁面網址]';

  // 取得狀態的中文標籤
  var statusLabel = STATUS_LABELS[newStatus] ? STATUS_LABELS[newStatus].zh : newStatus;

  var subject = '【進度更新】您的申請狀態已更新 - 訂單編號 ' + orderData.orderId;

  var body = orderData.customerName + ' 您好，\n\n' +
    '您的申請進度已更新：\n\n' +
    '訂單編號：' + orderData.orderId + '\n' +
    '目前狀態：' + statusLabel + '\n' +
    '更新時間：' + formatDateTime(updatedAt || new Date()) + '\n\n' +
    '查詢詳情：' + queryPageUrl + '\n\n' +
    '如有任何問題，請聯繫我們。';

  try {
    GmailApp.sendEmail(orderData.customerEmail, subject, body);
    Logger.log('狀態更新通知已發送至: ' + orderData.customerEmail);
    return true;
  } catch (e) {
    Logger.log('發送狀態更新通知失敗: ' + e.message);
    return false;
  }
}

/**
 * 發送新訂單通知給管理員
 * @param {Object} orderData - 訂單資料
 * @param {string} orderData.orderId - 訂單 ID
 * @param {string} orderData.customerName - 客戶姓名
 * @param {string} orderData.customerEmail - 客戶 Email
 * @param {string} orderData.customerPhone - 客戶電話
 * @param {string} orderData.serviceType - 服務類型
 * @param {Date} orderData.createdAt - 建立時間
 * @param {string} orderData.driveFolderUrl - Drive 資料夾連結
 */
function sendAdminNotification(orderData) {
  var adminEmails = getScriptProperty(SCRIPT_PROPERTY_KEYS.ADMIN_EMAILS);
  if (!adminEmails) {
    Logger.log('ADMIN_EMAILS 未設定，跳過管理員通知');
    return false;
  }

  var subject = '【新訂單】' + orderData.serviceType + ' - ' + orderData.customerName;

  var body = '新的申請已收到：\n\n' +
    '訂單編號：' + orderData.orderId + '\n' +
    '服務類型：' + orderData.serviceType + '\n' +
    '客戶姓名：' + orderData.customerName + '\n' +
    '客戶Email：' + orderData.customerEmail + '\n' +
    '客戶電話：' + orderData.customerPhone + '\n' +
    '申請時間：' + formatDateTime(orderData.createdAt) + '\n\n' +
    '文件資料夾：' + (orderData.driveFolderUrl || '無') + '\n\n' +
    '請至後台處理。';

  try {
    // 支援多個管理員 email (逗號分隔)
    var emailList = adminEmails.split(',').map(function(email) {
      return email.trim();
    });

    emailList.forEach(function(email) {
      if (email) {
        GmailApp.sendEmail(email, subject, body);
        Logger.log('管理員通知已發送至: ' + email);
      }
    });

    return true;
  } catch (e) {
    Logger.log('發送管理員通知失敗: ' + e.message);
    return false;
  }
}

// ============================================
// 工具函數
// ============================================

/**
 * 格式化日期時間
 * @param {Date} date - 日期物件
 * @returns {string} 格式化的日期時間字串
 */
function formatDateTime(date) {
  if (!date) {
    return '';
  }

  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  var year = date.getFullYear();
  var month = padZero(date.getMonth() + 1);
  var day = padZero(date.getDate());
  var hours = padZero(date.getHours());
  var minutes = padZero(date.getMinutes());

  return year + '/' + month + '/' + day + ' ' + hours + ':' + minutes;
}

/**
 * 數字補零
 * @param {number} num - 數字
 * @returns {string} 補零後的字串
 */
function padZero(num) {
  return num < 10 ? '0' + num : String(num);
}

// ============================================
// 測試函數
// ============================================

/**
 * 測試郵件發送
 * 注意：會發送真實郵件，請謹慎使用
 */
function testEmailService() {
  Logger.log('=== 郵件服務測試 ===');

  // 檢查必要設定
  var adminEmails = getScriptProperty(SCRIPT_PROPERTY_KEYS.ADMIN_EMAILS);
  Logger.log('ADMIN_EMAILS: ' + (adminEmails || '未設定'));

  // 模擬訂單資料
  var mockOrder = {
    orderId: generateUUID(),
    customerName: '測試客戶',
    customerEmail: Session.getActiveUser().getEmail(), // 發送給自己測試
    customerPhone: '0912-345-678',
    serviceType: '移民申請',
    createdAt: new Date(),
    driveFolderUrl: 'https://drive.google.com/example'
  };

  Logger.log('測試訂單 ID: ' + mockOrder.orderId);
  Logger.log('發送至: ' + mockOrder.customerEmail);

  // 取消下面的註解來實際發送測試郵件
  // var result = sendOrderConfirmation(mockOrder);
  // Logger.log('訂單確認信發送結果: ' + result);

  Logger.log('=== 測試完成 (郵件發送已註解) ===');
  Logger.log('如需測試實際發送，請取消 testEmailService 中的註解');
}
