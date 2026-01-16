/**
 * UUID.gs - UUID v4 生成器
 *
 * 生成符合 RFC 4122 的 UUID v4 格式
 * 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 *
 * 用途：
 * - order_id 生成 (不可預測、非連續)
 * - 資料夾命名
 */

/**
 * 生成 UUID v4
 * @returns {string} UUID 格式字串
 *
 * @example
 * var id = generateUUID();
 * // 輸出: "550e8400-e29b-41d4-a716-446655440000"
 */
function generateUUID() {
  var template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

  return template.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 驗證 UUID 格式
 * @param {string} uuid - 待驗證的字串
 * @returns {boolean} 是否為有效 UUID 格式
 */
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * 測試 UUID 生成
 */
function testUUID() {
  Logger.log('=== UUID 生成測試 ===');

  // 生成幾個 UUID 確認格式
  for (var i = 0; i < 5; i++) {
    var uuid = generateUUID();
    var valid = isValidUUID(uuid);
    Logger.log('UUID ' + (i + 1) + ': ' + uuid + ' (有效: ' + valid + ')');
  }

  // 測試唯一性 (簡單測試)
  var uuids = {};
  var count = 100;
  var duplicates = 0;

  for (var j = 0; j < count; j++) {
    var id = generateUUID();
    if (uuids[id]) {
      duplicates++;
    }
    uuids[id] = true;
  }

  Logger.log('生成 ' + count + ' 個 UUID，重複數: ' + duplicates);
  Logger.log('=== 測試完成 ===');
}
