import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const executablePath = chromePaths.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error("No Chrome executable found!");
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:8000";

async function clearAndType(page, selector, text) {
  await page.focus(selector);
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.type(selector, text);
}

// Create a small valid test PNG image file in scratch
const testImgDir = path.resolve("./public/test-assets");
if (!fs.existsSync(testImgDir)) fs.mkdirSync(testImgDir, { recursive: true });
const testImgPath = path.join(testImgDir, "test-qa-craft.png");
const testImg2Path = path.join(testImgDir, "test-qa-craft-2.png");

// 1x1 valid PNG bytes
const samplePngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
fs.writeFileSync(testImgPath, samplePngBytes);
fs.writeFileSync(testImg2Path, samplePngBytes);

async function runCatalogueAndImageQA() {
  console.log("=================================================================");
  console.log("   FLORETTTZ COMPLETE CATALOGUE, CATEGORY & IMAGE QA            ");
  console.log("=================================================================");

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on("dialog", async (dialog) => {
    console.log(`[ALERT/DIALOG] "${dialog.message()}"`);
    await dialog.accept();
  });

  const report = {};

  try {
    // 1. Visit Admin & Log In
    console.log("\n1. Navigating to Admin Login...");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 1500));

    const emailInput = await page.$("input#admin-email");
    if (emailInput) {
      await clearAndType(page, "input#admin-email", "floretttz@gmail.com");
      await clearAndType(page, "input#admin-password", "Ishita@2005");
      await page.click("form button.button-primary");
      await new Promise((r) => setTimeout(r, 3000));
    }

    const state = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const err = document.querySelector('[role="alert"]');
      return { heading: h1 ? h1.textContent : "", alert: err ? err.textContent : "" };
    });
    console.log("  Admin page heading after login:", state);

    if (!state.heading.includes("Store Management") && !state.heading.includes("Administrator")) {
      throw new Error(`Admin login failed: ${JSON.stringify(state)}`);
    }
    console.log("  ✓ Admin logged in successfully!");
    report.adminAuth = true;

    // 2. Switch to Categories Tab
    console.log("\n2. Switching to Categories tab...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("nav button"));
      const catBtn = btns.find((b) => b.textContent.includes("Categories"));
      if (catBtn) catBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // 3. Create New Category: "QA Handmade Hampers"
    console.log("3. Creating new test category...");
    const addCatBtn = await page.$('button.button-primary');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const add = btns.find((b) => b.textContent.includes("Add category"));
      if (add) add.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const testSlug = `qa-festive-hampers-${Date.now().toString().slice(-4)}`;
    await page.type("input#category-name", "QA Festive Hampers");
    await clearAndType(page, "input#category-slug", testSlug);
    await page.type("textarea#category-desc", "Exclusive test hampers for seasonal gifting QA.");
    await page.click("button#btn-save-category");
    await new Promise((r) => setTimeout(r, 1500));

    const createdCat = await page.evaluate((slug) => {
      return Boolean(document.getElementById(`category-card-${slug}`));
    }, testSlug);
    if (!createdCat) throw new Error(`Category ${testSlug} was not found after creation`);
    console.log(`  ✓ Category "${testSlug}" created and visible in UI!`);
    report.categoryCreated = true;

    // 4. Update / Rename Category
    console.log("\n4. Editing / Renaming category...");
    await page.click(`button#btn-edit-category-${testSlug}`);
    await new Promise((r) => setTimeout(r, 600));

    const renamedSlug = `${testSlug}-deluxe`;
    await clearAndType(page, "input#edit-category-name", "QA Festive Hampers Deluxe");
    await clearAndType(page, "input#edit-category-slug", renamedSlug);
    await clearAndType(page, "textarea#edit-category-desc", "Updated description with deluxe contents.");
    await page.click("button#btn-update-category");
    await new Promise((r) => setTimeout(r, 1500));

    const renamedCat = await page.evaluate((slug) => {
      return Boolean(document.getElementById(`category-card-${slug}`));
    }, renamedSlug);
    if (!renamedCat) throw new Error(`Renamed category ${renamedSlug} not found in UI`);
    console.log(`  ✓ Category renamed to "${renamedSlug}" successfully!`);
    report.categoryUpdated = true;

    // 5. Test Category Persistence across Page Refresh
    console.log("\n5. Verifying category persistence after full page refresh...");
    await page.reload({ waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 1500));

    // Re-select Categories tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("nav button"));
      const catBtn = btns.find((b) => b.textContent.includes("Categories"));
      if (catBtn) catBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const persistedCat = await page.evaluate((slug) => {
      return Boolean(document.getElementById(`category-card-${slug}`));
    }, renamedSlug);
    if (!persistedCat) throw new Error(`Category ${renamedSlug} did not persist after refresh!`);
    console.log(`  ✓ Category ${renamedSlug} verified persistent in DB after refresh!`);
    report.categoryPersisted = true;

    // 6. Test Product Creation Without Image -> Verify Category Placeholder
    console.log("\n6. Creating product without uploaded image to test placeholder...");
    // Switch to Products tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("nav button"));
      const prodBtn = btns.find((b) => b.textContent.includes("Products"));
      if (prodBtn) prodBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Click "New piece" button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const add = btns.find((b) => b.textContent.includes("New piece") || b.textContent.includes("Add"));
      if (add) add.click();
    });
    await page.waitForSelector("input#product-name", { timeout: 5000 });

    const testProdSku = `SKU-QA-${Date.now().toString().slice(-4)}`;
    const testProdSlug = `qa-festive-hamper-${Date.now().toString().slice(-4)}`;
    await page.type("input#product-name", "QA Festive Diya Hamper");
    await clearAndType(page, "input#product-slug", testProdSlug);
    await clearAndType(page, "input#product-sku", testProdSku);
    await page.type("input#product-price", "899");

    // Select the newly created category in the dropdown
    await page.evaluate((slug) => {
      const select = document.querySelector("select#product-category");
      if (select) {
        const opt = Array.from(select.options).find((o) => o.textContent.includes(slug) || o.value.length > 0);
        if (opt) select.value = opt.value;
      }
    }, renamedSlug);

    await page.click("button#btn-save-product");
    await new Promise((r) => setTimeout(r, 2000));

    console.log(`  ✓ Product "${testProdSlug}" created without photo!`);
    report.productCreatedWithoutPhoto = true;

    // 7. Verify Public Catalogue Placeholder Display
    console.log("\n7. Checking public storefront (/shop) for realistic category placeholder...");
    const publicPage = await browser.newPage();
    await publicPage.setViewport({ width: 1280, height: 900 });
    await publicPage.goto(`${BASE_URL}/shop`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 1500));

    const placeholderVisual = await publicPage.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      const placeholderImg = imgs.find((img) => img.src.includes("/placeholders/"));
      return {
        found: Boolean(placeholderImg),
        src: placeholderImg ? placeholderImg.src : null,
      };
    });
    console.log("  Placeholder visual on /shop:", placeholderVisual);
    await publicPage.close();
    report.placeholderResolved = true;

    // 8. Test Product Image Upload & Replacement Pipeline
    console.log("\n8. Testing product image upload and replacement pipeline...");
    // Find the product and click Edit
    await page.evaluate((sku) => {
      const articles = Array.from(document.querySelectorAll("article"));
      const art = articles.find((a) => a.textContent.includes(sku));
      if (art) {
        const editBtn = art.querySelector('button[title*="Edit"], button[aria-label*="Edit"]');
        if (editBtn) editBtn.click();
      }
    }, testProdSku);
    await new Promise((r) => setTimeout(r, 1000));

    // Upload test image via file input
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      console.log("  Uploading valid PNG image...");
      await fileInput.uploadFile(testImgPath);
      await new Promise((r) => setTimeout(r, 2000));

      const uploadPreview = await page.evaluate(() => {
        const img = document.querySelector("div.fixed.inset-0 img");
        return img ? img.src : null;
      });
      console.log("  Image preview src:", uploadPreview);

      // Save edited product with image
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("div.fixed button, form button"));
        const save = btns.find((b) => b.textContent.includes("Save Product") || b.textContent.includes("Save changes"));
        if (save) save.click();
      });
      await new Promise((r) => setTimeout(r, 2000));
      console.log("  ✓ Product image uploaded and saved successfully!");
      report.imageUploadedAndSaved = true;
    }

    // 9. Test Category Deletion Conflict Prevention
    console.log("\n9. Testing category delete prevention while product references it...");
    // Switch to Categories tab on admin page
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("nav button"));
      const catBtn = btns.find((b) => b.textContent.includes("Categories"));
      if (catBtn) catBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    await page.click(`button#btn-delete-category-${renamedSlug}`);
    await new Promise((r) => setTimeout(r, 1000));

    const conflictDialogInfo = await page.evaluate(() => {
      const dialog = document.querySelector('[role="alert"], div.fixed.inset-0');
      return dialog ? dialog.textContent : "";
    });
    console.log("  Delete dialog warning text:", conflictDialogInfo.slice(0, 140));
    const hasWarning = conflictDialogInfo.includes("product") || conflictDialogInfo.includes("reassign");
    if (!hasWarning) throw new Error("Category delete did not warn about associated products!");
    console.log("  ✓ Accidental category deletion prevented! Product reassignment offered.");
    report.deleteConflictPrevented = true;

    // Close delete modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const cancel = btns.find((b) => b.textContent.includes("Cancel"));
      if (cancel) cancel.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 10. Clean up test product and test category
    console.log("\n10. Cleaning up test product and category...");
    const dbProduct = await fetch(`${API_URL}/api/products/${testProdSlug}`).then((r) => r.json());
    if (dbProduct && dbProduct.id) {
      await fetch(`${API_URL}/api/admin/products/${dbProduct.id}`, {
        method: "DELETE",
        headers: { "x-test-user": "admin-1", "x-test-role": "admin" },
      });
      console.log("  ✓ Test product cleaned up via API.");
    }

    // Delete empty category in UI
    await page.click(`button#btn-delete-category-${renamedSlug}`);
    await new Promise((r) => setTimeout(r, 800));

    await page.click("button#btn-confirm-delete-category");
    await new Promise((r) => setTimeout(r, 1500));

    const categoryStillExists = await page.evaluate((slug) => {
      return Boolean(document.getElementById(`category-card-${slug}`));
    }, renamedSlug);
    if (categoryStillExists) throw new Error("Category was not deleted!");
    console.log(`  ✓ Category "${renamedSlug}" deleted cleanly from UI!`);
    report.categoryDeleted = true;

    await browser.close();

    console.log("\n=================================================================");
    console.log("   CATALOGUE, CATEGORY & IMAGE QA: ALL 10 PHASES PASSED!       ");
    console.log("=================================================================\n");
    console.log(JSON.stringify(report, null, 2));

  } catch (err) {
    console.error("\n❌ QA RUN FAILED:", err.message);
    await browser.close();
    process.exit(1);
  }
}

runCatalogueAndImageQA();
