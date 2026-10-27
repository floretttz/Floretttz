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
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:8000";

const testImgPath = path.resolve("./public/test-assets/test-qa-craft.png");

async function clearAndType(page, selector, text) {
  await page.focus(selector);
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.type(selector, text);
}

async function runImageUploadUITest() {
  console.log("=== TESTING IMAGE UPLOAD UI, PREVIEW & REPLACEMENT ===");

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on("dialog", async (d) => {
    console.log(`[DIALOG] ${d.message()}`);
    await d.accept();
  });

  try {
    // 1. Log in
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 1200));

    const emailInput = await page.$("input#admin-email");
    if (emailInput) {
      await clearAndType(page, "input#admin-email", "floretttz@gmail.com");
      await clearAndType(page, "input#admin-password", "Ishita@2005");
      await page.click("form button.button-primary");
      await new Promise((r) => setTimeout(r, 2000));
    }

    // 2. Open Products tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("nav button"));
      const prod = btns.find((b) => b.textContent.includes("Products"));
      if (prod) prod.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // 3. Open "New piece" modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const add = btns.find((b) => b.textContent.includes("New piece") || b.textContent.includes("Add"));
      if (add) add.click();
    });
    await page.waitForSelector("input#product-name", { timeout: 5000 });

    const prodSku = `SKU-IMG-${Date.now().toString().slice(-4)}`;
    const prodSlug = `img-test-${Date.now().toString().slice(-4)}`;
    await page.type("input#product-name", "Image QA Handcrafted Bouquets");
    await clearAndType(page, "input#product-slug", prodSlug);
    await clearAndType(page, "input#product-sku", prodSku);
    await page.type("input#product-price", "749");

    // Upload photo
    console.log("Attaching image file to new product modal...");
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error("File input not found in new product modal");
    await fileInput.uploadFile(testImgPath);
    await new Promise((r) => setTimeout(r, 2000));

    // Verify preview is visible
    const previewInfo = await page.evaluate(() => {
      const img = document.querySelector("div.fixed.inset-0 img[alt='Preview']");
      const label = document.querySelector("div.fixed.inset-0");
      return {
        hasPreviewImg: Boolean(img),
        src: img ? img.src : null,
        hasAttachedText: label ? label.textContent.includes("Photo attached") : false,
      };
    });
    console.log("Preview status in modal:", previewInfo);
    if (!previewInfo.hasPreviewImg || !previewInfo.hasAttachedText) {
      throw new Error("Image preview was not generated in modal!");
    }
    console.log("✓ Live image preview verified in Add Product modal!");

    // Save product
    await page.click("button#btn-save-product");
    await new Promise((r) => setTimeout(r, 2000));
    console.log("✓ Product saved with uploaded photo!");

    // Verify database record has image_url
    const prodRecord = await fetch(`${API_URL}/api/products/${prodSlug}`).then((r) => r.json());
    console.log("Database product image_url:", prodRecord.image_url);
    if (!prodRecord.image_url || !prodRecord.image_url.includes("/uploads/")) {
      throw new Error(`Product image_url in DB is invalid: ${prodRecord.image_url}`);
    }
    console.log("✓ Product image persisted in database!");

    // Clean up disposable test product
    if (prodRecord.id) {
      await fetch(`${API_URL}/api/admin/products/${prodRecord.id}`, {
        method: "DELETE",
        headers: { "x-test-user": "admin-1", "x-test-role": "admin" },
      });
      console.log("✓ Disposable product cleaned up cleanly.");
    }

    await browser.close();
    console.log("=== IMAGE UPLOAD UI TEST COMPLETED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("Image QA failed:", err);
    await browser.close();
    process.exit(1);
  }
}

runImageUploadUITest();
