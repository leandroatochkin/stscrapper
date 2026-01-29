// src/scrapers/types.ts
export interface ScrapedProduct {
  name: string;
  brand: string;
  price: number;
  link: string;
}

export interface IScraper {
  scrape(query: string): Promise<ScrapedProduct[]>;
}