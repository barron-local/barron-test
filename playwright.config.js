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
  fullyParallel: false, // รันเรียงทีละข้อตามลำดับ
  workers: 1,
  reporter: [
    ['./e2e/reporter.js']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://frontend.mydomain.lab',
    headless: false,
    screenshot: 'off',
    video: 'off',
    ignoreHTTPSErrors: true,
    channel: 'chrome',
    launchOptions: {
      slowMo: 1000,
    },
  },
});
