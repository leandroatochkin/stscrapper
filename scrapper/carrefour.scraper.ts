import { getPageHtml } from '../services/scraperEngine.service';
import { parseHtml, ScrapeConfig } from '../utils/htmlParser';

export async function scrapeCarrefour(query: any) {
  // 1. SAFETY: Extract string if it accidentally arrives as an object
  const searchString = typeof query === 'object' ? query.query : query;
  
  if (!searchString || searchString === '[object Object]') {
    console.error("[Carrefour] Error: Invalid query received:", query);
    return [];
  }

  // 2. BUILD URL
  const url = `https://www.carrefour.com.ar/${encodeURIComponent(searchString)}?_q=${encodeURIComponent(searchString)}&map=ft`;

  console.log(`[Carrefour] Full Target URL: ${url}`);
  
  const carrefourConfig: ScrapeConfig = {
    container: '.vtex-product-summary-2-x-container',
    name: '.vtex-product-summary-2-x-brandName',
    link: 'a.vtex-product-summary-2-x-clearLink',
    price: {
      wrapper: '.valtech-carrefourar-product-price-0-x-sellingPriceValue',
    },
    promo: 'span[data-specification-group="Ribbons"]',
    baseUrl: 'https://www.carrefour.com.ar'
  };

  try {
    console.log(`[Carrefour] Searching for: "${searchString}"`);
    const html = await getPageHtml(url);
    
    if (!html) return [];

    const products = parseHtml(html, carrefourConfig, "CARREFOUR");
    
    return products;
  } catch (error) {
    console.error("[Carrefour Scraper Error]:", error);
    return [];
  }
}