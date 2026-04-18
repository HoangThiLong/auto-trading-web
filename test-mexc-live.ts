import { timeSyncManager, fetchAccountInfo, placeOrder } from './src/services/mexcApi';

/**
 * MEXC API LIVE TEST SCRIPT
 * -------------------------
 * This script verifies connectivity, time synchronization, and permissions.
 */

const API_KEY = 'mx0vglgDltVcEMoZyH';
const SECRET_KEY = 'b0bbce9ccf8a4ce2ac120c418dbc2565';

async function runTest() {
  console.log('\n\x1b[36m==================================================\x1b[0m');
  console.log('\x1b[36m🚀 KHOI DONG KIEM TRA KET NOI MEXC LIVE API\x1b[0m');
  console.log('\x1b[36m==================================================\x1b[0m\n');

  try {
    // --- BƯỚC 1: ĐỒNG BỘ THỜI GIAN ---
    console.log('\x1b[33m[BUOC 1] Dang dong bo thoi gian voi MEXC...\x1b[0m');
    await timeSyncManager.syncTime();
    const offset = timeSyncManager.getOffset();
    
    if (Math.abs(offset) > 1000) {
      console.warn(`\x1b[31m⚠️ Canh bao: Do lech thoi gian lon: ${offset}ms\x1b[0m`);
    } else {
      console.log(`✅ Dong bo thanh cong. Do lech (offset): \x1b[32m${offset}ms\x1b[0m`);
    }

    // --- BƯỚC 2: KIỂM TRA QUYỀN ĐỌC (READ PERMISSION) ---
    console.log('\n\x1b[33m[BUOC 2] Dang kiem tra Quyen doc (Account Info)...\x1b[0m');
    const accountInfo = await fetchAccountInfo(API_KEY, SECRET_KEY);
    
    if (accountInfo) {
      console.log('\x1b[32m✅ Doc thong tin tai khoan thanh cong!\x1b[0m');
      // In ra so du USDT (thuong la trong mang accountInfo)
      const usdtAsset = Array.isArray(accountInfo) 
        ? accountInfo.find((a: any) => a.currency === 'USDT' || a.asset === 'USDT')
        : accountInfo;
      
      console.log(`📊 So du hien tai: \x1b[36m${JSON.stringify(usdtAsset || accountInfo)}\x1b[0m`);
    } else {
      console.error('\x1b[31m❌ Khong the doc thong tin tai khoan. Kiem tra lai API Key/Secret hoac IP Whitelist.\x1b[0m');
    }

    // --- BƯỚC 3: KIỂM TRA QUYỀN ĐẶT LỆNH (TRADE PERMISSION) ---
    console.log('\n\x1b[33m[BUOC 3] Dang kiem tra Quyen dat lenh (Trade Permission)...\x1b[0m');
    console.log('Dang thu dat lenh LONG BTC_USDT tai gia 10,000...');
    
    const testOrder = {
      symbol: 'BTC_USDT',
      price: 10000,
      vol: 1,        // Khối lượng nhỏ nhất (tùy sàn, thường 1 cont hoặc 0.0001 BTC)
      leverage: 20,
      side: 1,       // 1: Open Long
      type: 1,       // 1: Limit
      openType: 1    // 1: Isolated
    };

    const result = await placeOrder(API_KEY, SECRET_KEY, testOrder);
    
    if (result.success) {
      console.log('\x1b[32m✅ Dat lenh thanh cong (Ngoai du kien - Co the tai khoan da co tien!)\x1b[0m');
      console.log('Order ID:', result.data);
    } else {
      const msg = (result.message || '').toLowerCase();
      const code = String(result.code || '');
      
      console.log(`Pha hoi tu san: \x1b[90m${JSON.stringify(result)}\x1b[0m`);

      // Phan tich loi
      if (msg.includes('insufficient') || msg.includes('balance') || code === '30005' || code === '20001') {
        console.log('\n\x1b[42m\x1b[30m ✅ TÍNH NĂNG ĐẶT LỆNH HOẠT ĐỘNG TỐT! \x1b[0m \x1b[32m(Đã bị sàn chặn do tài khoản rỗng)\x1b[0m');
      } else if (msg.includes('signature') || msg.includes('api key') || msg.includes('permission') || code === '401' || code === '403') {
        console.log('\n\x1b[41m\x1b[37m ❌ LỖI QUYỀN TRUY CẬP / KEY SAI \x1b[0m');
        console.log(`\x1b[31mChi tiet: ${result.message}\x1b[0m`);
      } else {
        console.log(`\n\x1b[33m⚠️ Ket qua khac thuong: ${result.message}\x1b[0m`);
      }
    }

  } catch (error: any) {
    console.error('\n\x1b[31m❌ LOI HE THONG KHI CHAY TEST:\x1b[0m', error.message);
  } finally {
    console.log('\n\x1b[36m==================================================\x1b[0m');
    console.log('\x1b[36m🏁 KET THUC KIEM TRA\x1b[0m');
    console.log('\x1b[36m==================================================\x1b[0m');
    
    // Stop background sync to exit process
    timeSyncManager.stopAutoSync();
    process.exit(0);
  }
}

runTest();
