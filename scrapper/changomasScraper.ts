import { getPageHtml } from '../services/scraperEngine.service';
import { parseHtml, ScrapeConfig } from '../utils/htmlParser';

export async function scrapeChangoMas(query: string) {
  const url = `https://www.masonline.com.ar/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;
  
  const changoConfig: ScrapeConfig = {
    container: '.vtex-product-summary-2-x-container',
    name: '.vtex-product-summary-2-x-brandName',
    link: 'a.vtex-product-summary-2-x-clearLink',
    price: {
      wrapper: '.valtech-gdn-dynamic-product-1-x-dynamicProductPrice',
      integer: '.valtech-gdn-dynamic-product-1-x-currencyInteger',
      fraction: '.valtech-gdn-dynamic-product-1-x-currencyFraction'
    },
    promo: '.valtech-gdn-dynamic-product-1-x-weighableSavingsPercentage',
    baseUrl: 'https://www.masonline.com.ar'
  };

  try {
    console.log(`[ChangoMas] Navigating to: ${url}`);
    
    // Use the page from the factory to avoid the [object Object] error
    const html = await getPageHtml(url);
    
    if (!html) return [];
    
    const products = parseHtml(html, changoConfig, "CHANGOMAS");

    console.log(`[ChangoMas] Successfully parsed ${products.length} items.`);
    return products;

  } catch (error) {
    console.error("[ChangoMas Scraper Error]:", error);
    return [];
  }
}