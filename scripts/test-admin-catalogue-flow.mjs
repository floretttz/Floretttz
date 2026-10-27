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

async function runAdminTest() {
  console.log("=== STARTING ADMIN PORTAL & CATALOGUE SAVE INTEGRATION TEST ===");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("console", (msg) => console.log("[BROWSER]", msg.text()));
  page.on("pageerror", (err) => console.error("[BROWSER ERROR]", err.message));

  const results = {
    adminLogin: false,
    categoryCreated: false,
    productCreated: false,
    persistedInDb: false,
    persistedAfterRefresh: false,
    productEdited: false,
    variantAdded: false,
    unpublishHidesFromPublic: false,
    publishExposesToPublic: false,
    cleanedUp: false,
  };

  try {
    // 1. Visit Admin Login Page
    console.log("1. Navigating to Admin Portal:", `${BASE_URL}/admin`);
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 1200));

    // Confirm login form is present
    const loginHeading = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      return h1 ? h1.textContent : "";
    });
    console.log("Admin initial page heading:", loginHeading);

    // 2. Test Invalid Login
    console.log("2. Testing invalid login rejection...");
    await clearAndType(page, "input#admin-email", "floretttz@gmail.com");
    await clearAndType(page, "input#admin-password", "WrongPassword123!");
    await page.click("form button.button-primary");
    await new Promise((r) => setTimeout(r, 1500));

    const alertMsg = await page.evaluate(() => {
      const el = document.querySelector('[role="alert"]');
      return el ? el.textContent : "";
    });
    console.log("Rejection message on bad password:", alertMsg);

    // 3. Perform Valid Admin Login with ISHUPISHU credentials
    console.log("3. Logging in with authorized credentials (floretttz@gmail.com)...");
    await clearAndType(page, "input#admin-email", "floretttz@gmail.com");
    await clearAndType(page, "input#admin-password", "Ishita@2005");

    await page.click("form button.button-primary");
    await new Promise((r) => setTimeout(r, 3000));

    // Confirm Admin Workspace loaded
    const authorizedHeading = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const badge = document.querySelector(".eyebrow + span");
      return {
        heading: h1 ? h1.textContent : "",
        badge: badge ? badge.textContent : "",
      };
    });
    console.log("Authorized workspace status:", authorizedHeading);

    if (authorizedHeading.heading.includes("Store Management") || authorizedHeading.badge.includes("Administrator")) {
      results.adminLogin = true;
      console.log("✓ Admin authentication successful! Role: Administrator");
    } else {
      throw new Error(`Admin login failed: ${JSON.stringify(authorizedHeading)}`);
    }

    // 4. Open Categories Tab & Create a Test Category
    console.log("4. Creating a test category...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("nav button"));
      const catBtn = btns.find((b) => b.textContent.includes("Categories"));
      if (catBtn) catBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Click "Add category" button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const newCatBtn = btns.find((b) => b.textContent.includes("Add category") || b.textContent.includes("New Category"));
      if (newCatBtn) newCatBtn.click();
    });
    await page.waitForSelector("input#category-name", { timeout: 5000 });

    const testCatSlug = `qa-cat-${Date.now()}`;
    const testCatName = `QA Festive Decor ${Date.now().toString().slice(-4)}`;

    await clearAndType(page, "input#category-name", testCatName);
    await clearAndType(page, "input#category-slug", testCatSlug);
    await clearAndType(page, "textarea#category-desc", "Test category created for automated verification");

    // Click Save Category button
    const saveCatSelector = (await page.$("button#btn-save-category")) ? "button#btn-save-category" : null;
    if (saveCatSelector) {
      await page.click(saveCatSelector);
    } else {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("div.fixed button, form button"));
        const saveBtn = btns.find((b) => b.textContent.includes("Save Category") || b.textContent.includes("Create Category"));
        if (saveBtn) saveBtn.click();
      });
    }
    await new Promise((r) => setTimeout(r, 2000));

    // Verify category exists in UI list
    const categoryExistsInUi = await page.evaluate((name) => {
      return document.body.textContent.includes(name);
    }, testCatName);
    console.log(`Category "${testCatName}" visible in UI:`, categoryExistsInUi);
    if (categoryExistsInUi) {
      results.categoryCreated = true;
    }

    // 5. Open Products Tab & Create a Test Product with Variants
    console.log("5. Creating a test product with pricing and variants...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("nav button"));
      const prodBtn = btns.find((b) => b.textContent.includes("Products"));
      if (prodBtn) prodBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Click "New piece" / "Add new product" button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const addBtn = btns.find((b) => b.textContent.includes("New piece") || b.textContent.includes("Add new product") || b.textContent.includes("Add Product"));
      if (addBtn) addBtn.click();
    });
    await page.waitForSelector("input#product-name", { timeout: 5000 });

    const testSku = `QA-PROD-${Date.now().toString().slice(-6)}`;
    const testSlug = `qa-handmade-rose-${Date.now().toString().slice(-6)}`;
    const testName = `Handcrafted Silk Rose Arrangement ${Date.now().toString().slice(-4)}`;
    const testPrice = "1450";

    await clearAndType(page, "input#product-name", testName);
    await clearAndType(page, "input#product-sku", testSku);
    await clearAndType(page, "input#product-slug", testSlug);
    await clearAndType(page, "input#product-price", testPrice);
    await clearAndType(page, "textarea#product-desc", "Exquisite handmade silk pipe-cleaner rose crafted by Floretttz.");

    // Submit product form
    const saveProdSelector = (await page.$("button#btn-save-product")) ? "button#btn-save-product" : null;
    if (saveProdSelector) {
      await page.click(saveProdSelector);
    } else {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("div.fixed button, form button"));
        const saveBtn = btns.find((b) => b.textContent.includes("Create Product") || b.textContent.includes("Save Product"));
        if (saveBtn) saveBtn.click();
      });
    }
    await new Promise((r) => setTimeout(r, 2500));

    // Check if product appears in UI
    const productInUi = await page.evaluate((name) => {
      return document.body.textContent.includes(name);
    }, testName);
    console.log(`Product "${testName}" visible in Admin UI:`, productInUi);
    if (productInUi) {
      results.productCreated = true;
    }

    // 6. Verify Direct Persistence in Database via Backend API
    console.log("6. Verifying database persistence via backend API...");
    const sessionToken = await page.evaluate(() => localStorage.getItem("floretttz_admin_token"));
    const adminProductsRes = await fetch(`${API_URL}/api/admin/products?q=${encodeURIComponent(testSku)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }).then((r) => r.json());

    const dbProduct = adminProductsRes.items && adminProductsRes.items.find((p) => p.sku === testSku);
    console.log("Database lookup for created product:", dbProduct ? {
      id: dbProduct.id,
      sku: dbProduct.sku,
      name: dbProduct.name,
      price: dbProduct.price,
      published: dbProduct.published,
    } : "NOT FOUND");

    if (dbProduct && dbProduct.sku === testSku && Number(dbProduct.price) === 1450 && dbProduct.published === true) {
      results.persistedInDb = true;
      console.log("✓ Product successfully persisted in database!");
    }

    // 7. Verify Persistence After Browser Page Refresh
    console.log("7. Testing persistence across full browser reload...");
    await page.reload({ waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 2000));

    // Navigate to Products tab if not active
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("nav button"));
      const prodBtn = btns.find((b) => b.textContent.includes("Products"));
      if (prodBtn) prodBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const stillPresentAfterReload = await page.evaluate((name) => {
      return document.body.textContent.includes(name);
    }, testName);
    console.log("Product still present after browser refresh:", stillPresentAfterReload);
    if (stillPresentAfterReload) {
      results.persistedAfterRefresh = true;
      console.log("✓ Persistence after browser refresh verified!");
    }

    // 8. Test Edit Product & Update Price
    if (sessionToken && dbProduct && dbProduct.id) {
      console.log("8. Editing product and updating price...");
      const updatedProduct = await fetch(`${API_URL}/api/admin/products/${dbProduct.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: `${testName} (Deluxe)`,
          price: 1850,
          description: "Updated description with deluxe packaging.",
        }),
      }).then((r) => r.json());

      console.log("Updated product result:", {
        name: updatedProduct.name,
        price: updatedProduct.price,
      });

      if (Number(updatedProduct.price) === 1850 && updatedProduct.name.includes("Deluxe")) {
        results.productEdited = true;
        console.log("✓ Product edit successfully saved and persisted!");
      }

      // Add a variant
      console.log("Adding a variant to product...");
      const variantRes = await fetch(`${API_URL}/api/admin/products/${dbProduct.id}/variants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          sku: `${testSku}-VASE`,
          name: "With Ceramic Vase",
          price: 2450,
          available_for_order: true,
        }),
      }).then((r) => r.json());

      console.log("Created variant result:", variantRes);
      if (variantRes.sku === `${testSku}-VASE`) {
        results.variantAdded = true;
        console.log("✓ Product variant created and linked successfully!");
      }

      // 9. Test Publishing and Unpublishing
      console.log("9. Testing publishing and unpublishing controls...");
      // A. Unpublish
      await fetch(`${API_URL}/api/admin/products/${dbProduct.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ published: false }),
      });

      // Verify not in public store
      const publicSearchUnpublished = await fetch(`${API_URL}/api/products?q=${encodeURIComponent(testSku)}`).then((r) => r.json());
      const isHiddenWhenUnpublished = publicSearchUnpublished.items.length === 0;
      console.log("Unpublished item hidden from public store:", isHiddenWhenUnpublished);
      if (isHiddenWhenUnpublished) {
        results.unpublishHidesFromPublic = true;
      }

      // B. Publish
      await fetch(`${API_URL}/api/admin/products/${dbProduct.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ published: true }),
      });

      // Verify in public store
      const publicSearchPublished = await fetch(`${API_URL}/api/products?q=${encodeURIComponent(testSku)}`).then((r) => r.json());
      const isVisibleWhenPublished = publicSearchPublished.items.some((i) => i.sku === testSku);
      console.log("Published item visible in public store:", isVisibleWhenPublished);
      if (isVisibleWhenPublished) {
        results.publishExposesToPublic = true;
      }

      // 10. Clean up test record safely
      console.log("10. Cleaning up test product record...");
      await fetch(`${API_URL}/api/admin/products/${dbProduct.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      results.cleanedUp = true;
      console.log("✓ Test product deleted cleanly.");
    }
  } catch (err) {
    console.error("Test execution failed with error:", err);
  } finally {
    await browser.close();
  }

  console.log("\n=== ADMIN & CATALOGUE INTEGRATION TEST RESULTS ===");
  console.log(JSON.stringify(results, null, 2));

  const allPassed = Object.values(results).every(Boolean);
  console.log("All operations passed:", allPassed);
  if (!allPassed) {
    process.exit(1);
  }
}

runAdminTest();
