import * as cheerio from 'cheerio';
import { getPageHtml } from '../services/scraperEngine.service';

export async function scrapeChangoMas(query: string) {
  const url = `https://www.masonline.com.ar/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;
  
  try {
    const html = await getPageHtml(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const products: any[] = [];

    $('.vtex-product-summary-2-x-container').each((_, el) => {
      const card = $(el);

      // 1. Selector from your commented code (reliable)
      const name = card.find('.vtex-product-summary-2-x-brandName').first().text().trim();
      
      // 2. Link logic from your commented code
      const href = card.find('a.vtex-product-summary-2-x-clearLink').attr('href') || "";
      const fullLink = href.startsWith('http') ? href : `https://www.masonline.com.ar${href}`;

      // 3. Price logic (Join fragmented spans)
      const priceWrapper = card.find('.valtech-gdn-dynamic-product-1-x-dynamicProductPrice').first();
      const integers = priceWrapper.find('.valtech-gdn-dynamic-product-1-x-currencyInteger')
        .map((_, iEl) => $(iEl).text().trim())
        .get()
        .join('');

      const fraction = priceWrapper.find('.valtech-gdn-dynamic-product-1-x-currencyFraction').text().trim() || "00";

      // 4. Promo Text
      const promo = card.find('.valtech-gdn-dynamic-product-1-x-weighableSavingsPercentage').first().text().trim();

      if (name && integers) {
        // We calculate the float, then Math.round for your Prisma 'Int' field
        const rawPrice = parseFloat(`${integers}.${fraction.replace(/[^0-9]/g, '')}`);
        
        products.push({
          name: name,             // Matches Queue: product.name
          price: Math.round(rawPrice), // Matches Schema: Int
          promoText: promo || "", // Matches Queue: product.promoText
          link: fullLink,         // Matches Queue: product.link
          store: "CHANGOMAS"
        });
      }
    });

    console.log(`[ChangoMas] Successfully parsed ${products.length} items.`);
    return products;

  } catch (error) {
    console.error("Scraping failed:", error);
    return [];
  }
}