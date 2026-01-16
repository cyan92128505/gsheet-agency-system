GAS 後端 Phase 1-4 完成。已建立以下檔案：

  gas/
  ├── appsscript.json      # GAS 專案設定
  ├── Config.gs            # 常數與設定
  ├── CryptoJS.gs          # CryptoJS 函式庫 (需貼上程式碼)
  ├── Encryption.gs        # 加密/解密/雜湊工具
  ├── UUID.gs              # UUID v4 生成器
  ├── EmailService.gs      # 郵件發送服務
  ├── FormHandler.gs       # 表單提交處理
  ├── QueryHandler.gs      # 訂單查詢
  ├── AdminHandler.gs      # 管理員 API
  └── Code.gs              # Web App 主進入點

  部署前需要完成

  1. 貼上 CryptoJS
    - 下載 https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js
    - 貼入 gas/CryptoJS.gs 取代 CRYPTO_JS_PLACEHOLDER
  2. 設定 Script Properties (在 GAS 編輯器 > Project Settings > Script Properties)
    - AES_KEY - 32+ 字元的加密金鑰
    - SALT - 16+ 字元的雜湊鹽值
    - ADMIN_EMAILS - 管理員 email (逗號分隔)
  3. 初始化系統
    - 在 GAS 編輯器執行 initializeSystem() 建立 Sheet 結構
    - 執行 setupTriggers() 設定觸發器

  可用的測試函數

  - runAllTests() - 執行所有測試
  - showSystemStatus() - 顯示系統狀態
  - testEncryption() - 測試加密功能