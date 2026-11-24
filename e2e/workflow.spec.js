const { test, expect } = require('@playwright/test');

/**
 * End-to-End (E2E) Test Suite
 * ทดสอบ Workflow เส้นทางของผู้ใช้ตั้งแต่ต้นจนจบแบบต่อเนื่องในม้วนเดียว (Single Continuous Journey)
 * เข้าสู่ระบบครั้งเดียว -> บันทึกข้อมูล -> ค้นหาข้อมูล -> ออกจากระบบ
 */
test('E2E Full Workflow: ทดสอบระบบบริหารจัดการผู้ใช้ตั้งแต่ต้นจนจบ', async ({ page }) => {

  const testUser = `e2e_user_${Date.now().toString().slice(-4)}`;
  const testPassword = 'Password123!';

  // ==========================================
  // STEP 1: E2E-001 ผู้ใช้เข้าสู่ระบบสำเร็จ
  // ==========================================
  await test.step('E2E-001: ผู้ใช้เข้าสู่ระบบสำเร็จ (Login แล้วเห็นหน้า Dashboard)', async () => {
    // 1. ไปที่หน้าแรกของเว็บ
    await page.goto('/');

    // 2. กรอกชื่อผู้ใช้และรหัสผ่านของผู้ดูแลระบบ (Admin)
    await page.fill('input[placeholder="กรอกชื่อผู้ใช้..."]', 'admin');
    await page.fill('input[placeholder="กรอกรหัสผ่าน..."]', 'admin');

    // 3. กดปุ่มเข้าสู่ระบบ
    await page.click('button:has-text("เข้าสู่ระบบ")');

    // 4. ตรวจสอบว่าเข้าหน้า Dashboard สำเร็จ
    await expect(page.locator('h2')).toContainText('ระบบบริหารจัดการผู้ใช้');
    await expect(page.locator('.user-info')).toContainText('admin');
    await expect(page.locator('button:has-text("ออกจากระบบ (Logout)")')).toBeVisible();

    // บันทึกภาพหน้าจอเป็นหลักฐาน
    await page.screenshot({ path: 'playwright-report/screenshots/E2E-001-login-success.png' });
  });

  // ==========================================
  // STEP 2: E2E-002 ผู้ใช้ส่งข้อมูลสำเร็จ (กรอกฟอร์มแล้วบันทึก)
  // ==========================================
  await test.step('E2E-002: ผู้ใช้ส่งข้อมูลสำเร็จ (กรอกฟอร์มเพิ่มผู้ใช้ใหม่แล้วบันทึกสำเร็จ)', async () => {
    // 1. กรอกฟอร์มเพิ่มผู้ใช้ใหม่ (อยู่ในหน้า Dashboard ต่อเนื่องได้ทันที)
    await page.fill('input[placeholder="ชื่อผู้ใช้ (Username)"]', testUser);
    await page.fill('input[placeholder="รหัสผ่าน (Password)"]', testPassword);
    await page.selectOption('.admin-create-box select', 'readonly');

    // 2. กดปุ่มบันทึก
    await page.click('button:has-text("บันทึกผู้ใช้")');

    // 3. ตรวจสอบว่ารายชื่อใหม่ปรากฏในตาราง
    await page.waitForTimeout(1000);
    const tableContent = await page.textContent('table');
    expect(tableContent).toContain(testUser);

    // บันทึกภาพหน้าจอเป็นหลักฐาน
    await page.screenshot({ path: 'playwright-report/screenshots/E2E-002-create-user-success.png' });
  });

  // ==========================================
  // STEP 3: E2E-003 ค้นหาและกรองข้อมูล
  // ==========================================
  await test.step('E2E-003: ค้นหาข้อมูลในระบบ (Search & Filter)', async () => {
    // 1. พิมพ์ค้นหาผู้ใช้ที่เพิ่งสร้างในตาราง
    await page.fill('input[placeholder="ค้นหาชื่อผู้ใช้ (Search)..."]', testUser);
    await page.click('button:has-text("ค้นหาข้อมูล")');

    // 2. ตรวจสอบว่าในตารางพบชื่อที่ค้นหา
    await page.waitForTimeout(500);
    const tableContent = await page.textContent('table');
    expect(tableContent).toContain(testUser);

    // บันทึกภาพหน้าจอเป็นหลักฐาน
    await page.screenshot({ path: 'playwright-report/screenshots/E2E-003-search-success.png' });
  });

  // ==========================================
  // STEP 4: E2E-004 ออกจากระบบสำเร็จ
  // ==========================================
  await test.step('E2E-004: ออกจากระบบสำเร็จ (Logout แล้วกลับสู่หน้า Login)', async () => {
    // ดักรับกล่องข้อความ Popup กดยืนยันอัตโนมัติ
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    // 1. กดปุ่มออกจากระบบ
    await page.click('button:has-text("ออกจากระบบ (Logout)")');

    // 2. ตรวจสอบว่ากลับมาหน้าแบบฟอร์ม Login เรียบร้อย
    await expect(page.locator('button:has-text("เข้าสู่ระบบ")')).toBeVisible();
    await expect(page.locator('input[placeholder="กรอกชื่อผู้ใช้..."]')).toBeVisible();

    // บันทึกภาพหน้าจอเป็นหลักฐาน
    await page.screenshot({ path: 'playwright-report/screenshots/E2E-004-logout-success.png' });
  });

});
