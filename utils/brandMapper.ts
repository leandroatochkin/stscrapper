import fs from 'fs';
import path from 'path';

// Load brands into memory ONCE
const csvPath = path.resolve(process.cwd(), 'data/brands.csv');
const BRANDS = fs.readFileSync(csvPath, 'utf-8')
  .split(/\r?\n/)
  .map(b => b.trim().toUpperCase())
  .filter(b => b.length > 0)
  .sort((a, b) => b.length - a.length); // Longest first to avoid partial matches

export function extractBrand(productName: string): string {
  if (!productName) return "GENERIC";
  const upperName = productName.toUpperCase();

  for (const brand of BRANDS) {
    if (upperName.includes(brand)) {
      return brand;
    }
  }
  return "GENERIC";
}