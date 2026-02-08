import * as cheerio from 'cheerio';
import { normalizeText } from './helpers';

export interface ScrapeConfig {
  container: string;
  name: string;
  link: string;
  price: {
    wrapper: string;
    integer?: string;  // Optional: for split spans (ChangoMas)
    fraction?: string; // Optional: for split spans (ChangoMas)
  };
  promo: string;
  baseUrl?: string;
  sku?: string;
}

export function parseHtml(html: string, config: ScrapeConfig, storeName: string) {
  const $ = cheerio.load(html);
  const products: any[] = [];

  $(config.container).each((_, el) => {
    const card = $(el);

    const name = normalizeText(card.find(config.name).first().text().trim());
    const sku = card.find(config.sku).first().text().trim()
    const href = card.find(config.link).attr('href') || "";
    const fullLink = (config.baseUrl && !href.startsWith('http')) 
      ? `${config.baseUrl}${href}` 
      : href;

    const priceWrapper = card.find(config.price.wrapper).first();
    let rawPrice = 0;

    // STRATEGY A: Split Spans (ChangoMas style)
    if (config.price.integer) {
      const integers = priceWrapper.find(config.price.integer)
        .map((_, i) => $(i).text().replace(/[^0-9]/g, '').trim())
        .get()
        .join('');
      
      const fraction = config.price.fraction 
        ? priceWrapper.find(config.price.fraction).text().replace(/[^0-9]/g, '').trim() 
        : "00";

      if (integers) {
        rawPrice = parseFloat(`${integers}.${fraction || '00'}`);
      }
    } 
    // STRATEGY B: Single String (Carrefour style: "$ 1.250,50")
    else {
      // Inside parseHtml Strategy B
                const priceText = priceWrapper.text().trim(); // This will be "$3.000"
                if (priceText) {
                const cleanPrice = priceText
                    .replace(/\$/g, '')      // Remove $
                    .replace(/\s/g, '')      // Remove spaces
                    .replace(/\./g, '')      // Remove dots (thousands)
                    .replace(/,/g, '.');     // Convert comma to dot (if any)
                
                rawPrice = parseFloat(cleanPrice); // Should result in 3000
                }
    }

    // Only push if we have a valid name and a price greater than 0
    if (name && !isNaN(rawPrice) && rawPrice > 0) {
      products.push({
        name,
        // We multiply by 100 to save as "cents" (Int)
        // e.g., $1250.50 becomes 125050
        price: Math.round(rawPrice * 100), 
        link: fullLink,
        promoText: card.find(config.promo).first().text().trim() || "",
        store: storeName,
        scrapedAt: new Date(),
        sku: sku
      });
    }
  });

  return products;
}