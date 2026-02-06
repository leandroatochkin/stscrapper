// src/services/scraperEngine.ts
import dotenv from 'dotenv'
dotenv.config()
import axios from 'axios';
import { chromium, Browser } from 'playwright';

export async function getPageHtml(url: string): Promise<string> {
  const mode = process.env.SCRAPER_MODE || 'PLAYWRIGHT';

  if (mode === 'SCRAPINGBEE') {
    console.log(`[Engine] Fetching via ScrapingBee: ${url}`);
    const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
            'api_key': process.env.SCRAPINGBEE_API_KEY,
            'url': url,
            'render_js': 'true',
            'country_code': 'ar',
            'premium_proxy': 'true',
            // Change wait_for to the brandName span - it's the last thing to "pop in"
            'wait_for': '.vtex-product-summary-2-x-brandName', 
            'wait': '5000', // Increased to 5s to ensure the price API completes
            'block_resources': 'false',
            }
    });
    return response.data;
  } else {
    console.log(`[Engine] Launching Playwright for: ${url}`);
    const browser = await chromium.launch({ 
      headless: false,
      slowMo: 50 // Helps you actually see what's happening
    }); 
    
    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      });


// ... inside the else (Playwright) block
const page = await context.newPage();

// 1. Use 'networkidle' instead of 'domcontentloaded' 
// This ensures the price API calls have finished.
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 80000 });

try {
  // 2. Wait for the specific gallery item, not just the container
  await page.waitForSelector('.vtex-product-summary-2-x-container', { 
    state: 'attached', 
    timeout: 60000 
  });

  // 3. SCROLL DOWN. VTEX uses lazy loading. 
  // If you don't scroll, the grid items might exist but have no data.
  //await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await page.waitForTimeout(3000); // Small buffer for lazy elements
  
} catch (e) {
  console.log("[Engine] Product grid didn't appear.");
}

const html = await page.content();

return html;
    } catch (error) {
      console.error("[Engine] Playwright Error:", error);
      await browser.close();
      return "";
    } finally{
        await browser.close(); // Clean up!
    }
  }
}