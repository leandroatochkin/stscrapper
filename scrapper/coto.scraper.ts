import { chromium } from "playwright";

const BASE_URL = "https://www.cotodigital.com.ar/sitios/cdigi/nuevositio";

export async function scrapeCoto(query: string) {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const page = await browser.newPage();

  try {
    console.log("1. Navigating to Coto...");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    
    // Wait for Angular to load
    await page.waitForTimeout(3000);

    console.log("2. Looking for search input...");
    
    // Try multiple strategies to find and interact with the search input
    const searchInput = await page.locator('input[placeholder*="Qué querés comprar"]').first();
    
    // Check if visible
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    console.log("Search input found!");

    // Scroll into view
    await searchInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Click multiple times to ensure focus
    await searchInput.click({ clickCount: 3 });
    await page.waitForTimeout(500);

    // Clear any existing text
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    
    console.log(`3. Typing query: "${query}"...`);
    await searchInput.fill(query);
    await page.waitForTimeout(1000);

    console.log("4. Submitting search...");
    
    // Try pressing Enter
    await page.keyboard.press('Enter');
    
    // Wait for either navigation or dynamic content update
    await Promise.race([
      page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
      page.waitForSelector('.card-container', { timeout: 10000 }).catch(() => {}),
      page.waitForTimeout(5000)
    ]);

    console.log("5. Waiting for products...");
    
    // Wait for product cards to appear
    await page.waitForSelector('.card-container', { timeout: 15000 });
    
    // Additional wait for content to settle
    await page.waitForTimeout(2000);

    console.log("6. Extracting product data...");
    
    const products = await page.$$eval('.card-container', (cards) => {
      return cards.slice(0, 5).map(card => {
        // Get name
        const nameEl = card.querySelector('.nombre-producto');
        const name = nameEl?.textContent?.trim() || "";
        
        // Get price
        const priceEl = card.querySelector('.card-title');
        const priceText = priceEl?.textContent?.trim() || "0";
        const price = Number(
          priceText
            .replace(/\$/g, "")
            .replace(/\./g, "")
            .replace(/,/g, ".")
            .replace(/[^0-9.]/g, "")
        );
        
        // Get link
        const linkEl = card.closest('a');
        const link = linkEl?.getAttribute('href') || "";
        const fullLink = link.startsWith('http') 
          ? link 
          : `https://www.cotodigital.com.ar${link}`;
        
        // Get promo text
        const promoEl = card.querySelector('.cucarda-promo');
        const promoText = promoEl?.textContent?.trim() || null;
        
        return { name, price, link: fullLink, promoText };
      });
    });

    console.log(`7. Found ${products.length} products`);
    return products;

  } catch (err) {
    console.error("Coto Scraper Error:", err);
    
    // Take a screenshot for debugging
    try {
      await page.screenshot({ path: 'coto-error.png', fullPage: true });
      console.log("Screenshot saved to coto-error.png");
    } catch (screenshotErr) {
      console.error("Could not take screenshot:", screenshotErr);
    }
    
    return [];
  } finally {
    await browser.close();
  }
}