import { Page } from "playwright";

const BASE_URL = "https://www.masonline.com.ar/";

export async function scrapeChangoMas(page: Page, query: string) {
  try {
    console.log(`[ChangoMas] Searching for: ${query}`);

    const searchUrl = `${BASE_URL}${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;
    
    // 1. Increase the wait. "networkidle" is better for VTEX if the connection is stable.
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 60000 });

    // 2. Force a scroll. This often triggers the lazy-loading of VTEX components.
    //await page.evaluate(() => window.scrollBy(0, 400));

    // 3. WAIT for the actual name element to appear, not just the container.
    // If the skeleton is there but not the name, this will wait.
    await page.waitForSelector('.vtex-product-summary-2-x-brandName', { timeout: 30000 });

    // 4. Extraction Logic (using your specific HTML structure)
    const products = await page.$$eval('.vtex-product-summary-2-x-container', (cards) => {
      return cards.slice(0, 12).map(card => {
        const nameEl = card.querySelector('.vtex-product-summary-2-x-brandName');
        const name = nameEl?.textContent?.trim() || "";

        const linkEl = card.querySelector('a.vtex-product-summary-2-x-clearLink');
        const href = linkEl?.getAttribute('href') || "";
        
        // Price Logic: Joining the split integers
        const priceContainer = card.querySelector('.valtech-gdn-dynamic-product-1-x-dynamicProductPrice');
        let price = 0;
        
        if (priceContainer) {
          const integers = Array.from(priceContainer.querySelectorAll('.valtech-gdn-dynamic-product-1-x-currencyInteger'))
            .map((el: any) => el.textContent?.trim())
            .join("");
            
          const fraction = priceContainer.querySelector('.valtech-gdn-dynamic-product-1-x-currencyFraction')?.textContent?.trim() || "00";
          price = Number(`${integers}.${fraction.replace(/[^0-9]/g, "")}`);
        }

        const isUnavailable = card.textContent?.includes("No Disponible") || false;

        return { 
          name, 
          price: isUnavailable ? 0 : price, 
          link: href.startsWith('http') ? href : `https://www.masonline.com.ar${href}`
        };
      });
    }); 

    const final = products.filter(p => p.name.length > 0 && p.price > 0);
    console.log(`[ChangoMas] Found ${final.length} products after waiting.`);
    return final;

  } catch (err) {
    console.error("[ChangoMas Scraper Error]:", err);
    return [];
  }
}