import puppeteer from "puppeteer-core";
import fs from "fs";

const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const executablePath = chromePaths.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error("No Chrome or Edge executable found!");
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BREAKPOINTS = [320, 375, 430, 768, 1024, 1440];

async function measureSearchInput(page, inputSelector, iconSelector, description) {
  return await page.evaluate(
    ({ inSel, iconSel, desc }) => {
      const input = document.querySelector(inSel);
      const icon = document.querySelector(iconSel);
      if (!input) return { error: `Input "${inSel}" not found for ${desc}` };
      if (!icon) return { error: `Icon "${iconSel}" not found for ${desc}` };

      const inRect = input.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const computed = window.getComputedStyle(input);
      const paddingLeft = parseFloat(computed.paddingLeft) || 0;

      // Text begins at input's left border + paddingLeft
      const textStartX = inRect.left + paddingLeft;
      const iconEndX = iconRect.right;
      const clearance = textStartX - iconEndX;

      return {
        description: desc,
        inputRect: { left: inRect.left, width: inRect.width },
        iconRect: { left: iconRect.left, right: iconRect.right, width: iconRect.width },
        paddingLeft,
        clearance,
        overlaps: clearance <= 0,
      };
    },
    { inSel: inputSelector, iconSel: iconSelector, desc: description }
  );
}

async function runSearchAudit() {
  console.log("=================================================================");
  console.log("   FLORETTTZ SEARCH ICON & PLACEHOLDER ZERO-OVERLAP AUDIT        ");
  console.log("=================================================================");

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const width of BREAKPOINTS) {
    console.log(`\n--- TESTING BREAKPOINT: ${width}px ---`);
    await page.setViewport({ width, height: 800 });

    // 1. Audit Shop Catalogue Search (/shop)
    await page.goto(`${BASE_URL}/shop`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 600));

    // Empty state (placeholder)
    totalTests++;
    const shopEmpty = await measureSearchInput(
      page,
      "#shop-search",
      'label[for="shop-search"] ~ svg',
      `Shop Search (${width}px - Empty Placeholder)`
    );
    if (!shopEmpty.error && !shopEmpty.overlaps && shopEmpty.clearance >= 10) {
      console.log(`  ✓ ${shopEmpty.description}: padding-left=${shopEmpty.paddingLeft}px, clearance=${shopEmpty.clearance.toFixed(1)}px (ZERO overlap)`);
      passedTests++;
    } else {
      console.error(`  ✗ ${shopEmpty.description} FAILED:`, shopEmpty);
      failedTests++;
    }

    // Populated state (typed text)
    await page.type("#shop-search", "Handmade Sunflower");
    totalTests++;
    const shopFilled = await measureSearchInput(
      page,
      "#shop-search",
      'label[for="shop-search"] ~ svg',
      `Shop Search (${width}px - Populated Text)`
    );
    if (!shopFilled.error && !shopFilled.overlaps && shopFilled.clearance >= 10) {
      console.log(`  ✓ ${shopFilled.description}: padding-left=${shopFilled.paddingLeft}px, clearance=${shopFilled.clearance.toFixed(1)}px (ZERO overlap)`);
      passedTests++;
    } else {
      console.error(`  ✗ ${shopFilled.description} FAILED:`, shopFilled);
      failedTests++;
    }

    // 2. Audit Header Search
    if (width >= 1024) {
      // Desktop Header Search
      totalTests++;
      const deskHeader = await measureSearchInput(
        page,
        "#header-search",
        'label[for="header-search"] ~ div svg',
        `Desktop Header Search (${width}px)`
      );
      if (!deskHeader.error && !deskHeader.overlaps && deskHeader.clearance >= 10) {
        console.log(`  ✓ ${deskHeader.description}: padding-left=${deskHeader.paddingLeft}px, clearance=${deskHeader.clearance.toFixed(1)}px (ZERO overlap)`);
        passedTests++;
      } else {
        console.error(`  ✗ ${deskHeader.description} FAILED:`, deskHeader);
        failedTests++;
      }
    } else {
      // Mobile Drawer Header Search (only if mobile toggle is visible)
      const toggleBtn = await page.$('button[aria-controls="mobile-navigation"]');
      if (toggleBtn) {
        const isVisible = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== "none" && style.visibility !== "hidden" && el.offsetWidth > 0;
        }, toggleBtn);

        if (isVisible) {
          await toggleBtn.click();
          await new Promise((r) => setTimeout(r, 300));
          totalTests++;
          const mobHeader = await measureSearchInput(
            page,
            "#mobile-search",
            'label[for="mobile-search"] ~ div svg',
            `Mobile Drawer Search (${width}px)`
          );
          if (!mobHeader.error && !mobHeader.overlaps && mobHeader.clearance >= 10) {
            console.log(`  ✓ ${mobHeader.description}: padding-left=${mobHeader.paddingLeft}px, clearance=${mobHeader.clearance.toFixed(1)}px (ZERO overlap)`);
            passedTests++;
          } else {
            console.error(`  ✗ ${mobHeader.description} FAILED:`, mobHeader);
            failedTests++;
          }
        }
      }
    }
  }

  // 3. Audit Admin Portal Product Search
  console.log(`\n--- TESTING ADMIN PRODUCTS SEARCH ---`);
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 600));

  // Log in to access Products tab
  const emailInput = await page.$("input#admin-email");
  if (emailInput) {
    await emailInput.type("floretttz@gmail.com");
    await page.type("input#admin-password", "Ishita@2005");
    await page.click("form button.button-primary");
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Switch to Products tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("nav button"));
    const prodBtn = btns.find((b) => b.textContent.includes("Products"));
    if (prodBtn) prodBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Check Admin Product search input
  totalTests++;
  const adminSearch = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="Search by name"]');
    if (!input) return { error: "Admin search input not found" };
    const container = input.parentElement;
    const icon = container ? container.querySelector("svg") : null;
    if (!icon) return { error: "Admin search icon not found" };

    const inRect = input.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const computed = window.getComputedStyle(input);
    const paddingLeft = parseFloat(computed.paddingLeft) || 0;
    const clearance = inRect.left + paddingLeft - iconRect.right;

    return {
      description: "Admin Products Search Input",
      paddingLeft,
      clearance,
      overlaps: clearance <= 0,
    };
  });

  if (!adminSearch.error && !adminSearch.overlaps && adminSearch.clearance >= 10) {
    console.log(`  ✓ ${adminSearch.description}: padding-left=${adminSearch.paddingLeft}px, clearance=${adminSearch.clearance.toFixed(1)}px (ZERO overlap)`);
    passedTests++;
  } else {
    console.error(`  ✗ Admin search FAILED:`, adminSearch);
    failedTests++;
  }

  await browser.close();

  console.log("\n=================================================================");
  console.log(`   SEARCH AUDIT COMPLETE: ${passedTests}/${totalTests} PASSED (Failed: ${failedTests})`);
  console.log("=================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSearchAudit().catch((err) => {
  console.error("Search audit fatal error:", err);
  process.exit(1);
});
