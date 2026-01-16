/**
 * CryptoJS.gs - CryptoJS 函式庫
 *
 * 安裝步驟：
 * 1. 前往 https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js
 * 2. 複製完整的 JavaScript 程式碼
 * 3. 將下方的 PLACEHOLDER 替換為複製的程式碼
 *
 * 或者使用以下命令下載：
 * curl -o crypto-js.min.js https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js
 *
 * 注意事項：
 * - CryptoJS 在 GAS 環境中可直接使用
 * - 貼上後 CryptoJS 物件會成為全域可用
 * - 本專案使用的功能：CryptoJS.AES, CryptoJS.SHA256, CryptoJS.enc.Utf8
 */

// ====================================================
// 請將 CryptoJS minified 程式碼貼在這裡
// 取代 CRYPTO_JS_PLACEHOLDER 這一行
// ====================================================

// CRYPTO_JS_PLACEHOLDER

// ====================================================
// 驗證 CryptoJS 是否正確載入
// ====================================================

/**
 * 測試 CryptoJS 是否可用
 * 在 GAS 編輯器中執行此函數來驗證
 */
function testCryptoJS() {
  try {
    // 測試 SHA256
    var hash = CryptoJS.SHA256('test').toString();
    Logger.log('SHA256 測試: ' + hash);

    // 測試 AES 加密/解密
    var encrypted = CryptoJS.AES.encrypt('hello world', 'secret key').toString();
    Logger.log('AES 加密: ' + encrypted);

    var decrypted = CryptoJS.AES.decrypt(encrypted, 'secret key').toString(CryptoJS.enc.Utf8);
    Logger.log('AES 解密: ' + decrypted);

    if (decrypted === 'hello world') {
      Logger.log('CryptoJS 運作正常！');
      return true;
    } else {
      Logger.log('解密結果不符');
      return false;
    }
  } catch (e) {
    Logger.log('CryptoJS 錯誤: ' + e.message);
    Logger.log('請確認已將 CryptoJS 程式碼貼入此檔案');
    return false;
  }
}
