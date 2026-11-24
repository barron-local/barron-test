// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * Playwright Config ออกแบบให้รันได้ 100% แม้ไม่มีอินเทอร์เน็ต (Offline-ready)
 * โดยใช้ Chrome หรือ Edge ที่มีติดตั้งอยู่แล้วบนเครื่อง Windows
 */
module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false, // รันเรียงทีละข้อตามลำดับ Workflow E2E
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    // กำหนด URL ของหน้าเว็บ (รองรับทั้ง localhost และโดเมน)
    baseURL: process.env.BASE_URL || 'https://frontend.mydomain.lab',
    headless: false, // เปิดหน้าต่าง Chrome ให้กรรมการเห็นตอนทดสอบ (ปรับเป็น true ได้)
    screenshot: 'on', // ถ่ายภาพหน้าจอทุกขั้นตอนเก็บเป็นหลักฐาน
    video: 'off',
    ignoreHTTPSErrors: true, // ข้ามแจ้งเตือน Self-signed certificate (ถ้ามี)
    // ใช้ Google Chrome ที่อยู่ในเครื่อง
    channel: 'chrome',
  },
});
