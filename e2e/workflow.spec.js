const { test, expect } = require('@playwright/test');

test.describe.serial('E2E Test', () => {
  let context;
  let page;

  const testUser = `tnk-${Date.now().toString().slice(-4)}`;
  const testPassword = 'Password123!';

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ ignoreHTTPSErrors: true });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('E2E-001: ผู้ใช้เข้าสู่ระบบสำเร็จ', async () => {
    await page.goto('/');
    await page.fill('input[placeholder="กรอกชื่อผู้ใช้..."]', 'admin');
    await page.fill('input[placeholder="กรอกรหัสผ่าน..."]', 'admin');
    await page.click('button:has-text("เข้าสู่ระบบ")');

    await expect(page.locator('h2')).toContainText('ระบบบริหารจัดการผู้ใช้');
    await expect(page.locator('.user-info')).toContainText('admin');
    await expect(page.locator('button:has-text("ออกจากระบบ (Logout)")')).toBeVisible();
  });

  test('E2E-002: ผู้ใช้ส่งข้อมูลสำเร็จ', async () => {
    await page.fill('input[placeholder="ชื่อผู้ใช้ (Username)"]', testUser);
    await page.fill('input[placeholder="รหัสผ่าน (Password)"]', testPassword);
    await page.selectOption('.admin-create-box select', 'readonly');
    await page.click('button:has-text("บันทึกผู้ใช้")');

    await page.waitForTimeout(1000);
    const tableContent = await page.textContent('table');
    expect(tableContent).toContain(testUser);
  });

  test('E2E-003: ผู้ใช้ค้นหาข้อมูลสำเร็จ', async () => {
    await page.fill('input[placeholder="ค้นหาชื่อผู้ใช้ (Search)..."]', testUser);
    await page.selectOption('.filter-bar select:has(option[value="readonly"])', 'readonly');
    await page.selectOption('.filter-bar select:has(option[value="on"])', 'on');
    await page.click('button:has-text("ค้นหาข้อมูล")');

    await page.waitForTimeout(500);
    const tableContent = await page.textContent('table');
    expect(tableContent).toContain(testUser);

    await page.click('button:has-text("ล้างตัวกรอง")');
  });

  test('E2E-004: ผู้ใช้ออกจากระบบสำเร็จ', async () => {
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    await page.click('button:has-text("ออกจากระบบ (Logout)")');

    await expect(page.locator('button:has-text("เข้าสู่ระบบ")')).toBeVisible();
    await expect(page.locator('input[placeholder="กรอกชื่อผู้ใช้..."]')).toBeVisible();
  });
});
