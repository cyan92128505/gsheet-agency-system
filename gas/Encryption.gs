/**
 * Encryption.gs - 加密、解密與雜湊工具函數
 *
 * 依賴：
 * - CryptoJS.gs (需先載入 CryptoJS 函式庫)
 * - Config.gs (Script Properties keys)
 *
 * 安全注意事項：
 * - AES_KEY 和 SALT 必須存放在 Script Properties
 * - 切勿在程式碼中硬編碼任何密鑰
 * - POC 使用 AES-256-CBC (CryptoJS passphrase 模式)
 */

// ============================================
// AES 加密/解密
// ============================================

/**
 * AES 加密
 * @param {string} plaintext - 明文
 * @returns {string} Base64 編碼的密文
 */
function encrypt(plaintext) {
  if (!plaintext || plaintext.trim() === '') {
    return '';
  }

  var key = getScriptProperty(SCRIPT_PROPERTY_KEYS.AES_KEY);
  if (!key) {
    throw new Error('AES_KEY 未設定。請在 Script Properties 中設定。');
  }

  try {
    var encrypted = CryptoJS.AES.encrypt(plaintext, key);
    return encrypted.toString();
  } catch (e) {
    throw new Error('加密失敗: ' + e.message);
  }
}

/**
 * AES 解密
 * @param {string} ciphertext - Base64 編碼的密文
 * @returns {string} 明文
 */
function decrypt(ciphertext) {
  if (!ciphertext || ciphertext.trim() === '') {
    return '';
  }

  var key = getScriptProperty(SCRIPT_PROPERTY_KEYS.AES_KEY);
  if (!key) {
    throw new Error('AES_KEY 未設定。請在 Script Properties 中設定。');
  }

  try {
    var decrypted = CryptoJS.AES.decrypt(ciphertext, key);
    var plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plaintext) {
      throw new Error('解密結果為空，可能是密鑰錯誤');
    }

    return plaintext;
  } catch (e) {
    throw new Error('解密失敗: ' + e.message);
  }
}

// ============================================
// SHA-256 雜湊
// ============================================

/**
 * 生成訂單驗證雜湊
 * 用於客戶查詢訂單時的身份驗證
 *
 * @param {string} email - 客戶 email
 * @param {string} orderId - 訂單 ID
 * @returns {string} SHA-256 雜湊值 (hex)
 */
function hashForVerification(email, orderId) {
  if (!email || !orderId) {
    throw new Error('email 和 orderId 不可為空');
  }

  var salt = getScriptProperty(SCRIPT_PROPERTY_KEYS.SALT);
  if (!salt) {
    throw new Error('SALT 未設定。請在 Script Properties 中設定。');
  }

  // 組合: email + salt + orderId
  var combined = email.toLowerCase().trim() + salt + orderId;

  try {
    var hash = CryptoJS.SHA256(combined);
    return hash.toString();
  } catch (e) {
    throw new Error('雜湊計算失敗: ' + e.message);
  }
}

/**
 * 驗證訂單查詢請求
 * @param {string} email - 客戶輸入的 email
 * @param {string} orderId - 客戶輸入的訂單 ID
 * @param {string} storedHash - 資料庫中儲存的 hash
 * @returns {boolean} 是否驗證通過
 */
function verifyOrderAccess(email, orderId, storedHash) {
  if (!email || !orderId || !storedHash) {
    return false;
  }

  var calculatedHash = hashForVerification(email, orderId);
  return calculatedHash === storedHash;
}

// ============================================
// 測試函數
// ============================================

/**
 * 測試加密功能
 * 在 GAS 編輯器中執行此函數來驗證
 */
function testEncryption() {
  Logger.log('=== 加密功能測試 ===');

  // 檢查 Script Properties
  var aesKey = getScriptProperty(SCRIPT_PROPERTY_KEYS.AES_KEY);
  var salt = getScriptProperty(SCRIPT_PROPERTY_KEYS.SALT);

  Logger.log('AES_KEY 已設定: ' + (aesKey ? '是' : '否'));
  Logger.log('SALT 已設定: ' + (salt ? '是' : '否'));

  if (!aesKey || !salt) {
    Logger.log('請先設定 AES_KEY 和 SALT');
    Logger.log('路徑: Project Settings > Script Properties');
    return;
  }

  // 測試加密/解密
  var testData = 'A123456789'; // 模擬身分證字號
  Logger.log('原始資料: ' + testData);

  var encrypted = encrypt(testData);
  Logger.log('加密後: ' + encrypted);

  var decrypted = decrypt(encrypted);
  Logger.log('解密後: ' + decrypted);

  Logger.log('加密解密測試: ' + (testData === decrypted ? '通過' : '失敗'));

  // 測試雜湊
  var testEmail = 'test@example.com';
  var testOrderId = generateUUID();
  var hash = hashForVerification(testEmail, testOrderId);
  Logger.log('驗證雜湊: ' + hash);
  Logger.log('雜湊長度: ' + hash.length + ' 字元');

  // 驗證雜湊
  var verified = verifyOrderAccess(testEmail, testOrderId, hash);
  Logger.log('雜湊驗證測試: ' + (verified ? '通過' : '失敗'));

  // 錯誤案例
  var wrongVerify = verifyOrderAccess('wrong@email.com', testOrderId, hash);
  Logger.log('錯誤 email 驗證: ' + (wrongVerify ? '應該失敗' : '正確拒絕'));

  Logger.log('=== 測試完成 ===');
}

/**
 * 初始化測試用的 Script Properties
 * 僅供開發測試使用，生產環境請手動設定安全的密鑰
 */
function initTestProperties() {
  var props = PropertiesService.getScriptProperties();

  // 警告：這些是測試用密鑰，請勿用於生產環境
  if (!props.getProperty(SCRIPT_PROPERTY_KEYS.AES_KEY)) {
    props.setProperty(SCRIPT_PROPERTY_KEYS.AES_KEY, 'POC-TEST-KEY-CHANGE-IN-PRODUCTION-32CHARS!');
    Logger.log('已設定測試用 AES_KEY');
  }

  if (!props.getProperty(SCRIPT_PROPERTY_KEYS.SALT)) {
    props.setProperty(SCRIPT_PROPERTY_KEYS.SALT, 'POC-TEST-SALT-16CH');
    Logger.log('已設定測試用 SALT');
  }

  Logger.log('測試屬性初始化完成');
  Logger.log('警告: 請在生產環境使用安全的隨機密鑰');
}
