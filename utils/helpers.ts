import storesData from '../data/stores.json';

export const getStoresForLocation = (city: string, province: string): string[] => {
  
  // Normalize the incoming string to a clean, uppercase, no-underscore version for comparison
  const cleanInput = (str: string) => str.toUpperCase().replace(/_/g, ' ').trim();

  const provinceMap: Record<string, string> = {
    "PROVINCIA DE BUENOS AIRES": "BUENOS_AIRES",
    "BUENOS AIRES": "BUENOS_AIRES",
    "CABA": "CABA",
    "SANTA FE": "SANTA_FE"
  };

  const rawProv = cleanInput(province); // Turns "PROVINCIA_DE_BUENOS_AIRES" -> "PROVINCIA DE BUENOS AIRES"
  const normalizedProv = provinceMap[rawProv] || rawProv.replace(/\s+/g, '_');
  
  const normalizedCity = city.toUpperCase().trim().replace(/\s+/g, '_');

  const availableStores: string[] = [];

  Object.entries(storesData).forEach(([storeKey, config]: [string, any]) => {
    const isNational = config.provinces.includes("ALL");
    const isProvincial = config.provinces.includes(normalizedProv);
    const isCitySpecific = config.major_cities?.includes(normalizedCity);

    if (isNational || isProvincial || isCitySpecific) {
      availableStores.push(storeKey);
    }
  });

  return availableStores;
};

export function normalizeText(text: string): string {
  return text
    .toUpperCase()
    // 1. Replace Ñ with a placeholder before normalizing
    .replace(/Ñ/g, "___N_TILDE___") 
    // 2. Decompose characters (vowels lose accents)
    .normalize("NFD")
    // 3. Strip combining marks
    .replace(/[\u0300-\u036f]/g, "")
    // 4. Restore the Ñ
    .replace(/___N_TILDE___/g, "Ñ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Unified parser for Argentine retail prices.
 * @param text The main price string (or the integer part)
 * @param decimalPart Optional: The cents part (used for La Coope split elements)
 * @param includeDecimals If false, it truncates the value (Coto/Toledo/Dia)
 */
export function parsePrice(
  text: string, 
  decimalPart?: string, 
  includeDecimals: boolean = true
): number {
  if (!text) return 0;

  // 1. If decimalPart is provided (La Coope style)
  if (decimalPart !== undefined) {
    const integer = text.replace(/[^\d]/g, '');
    const decimals = decimalPart.replace(/[^\d]/g, '') || "00";
    return parseFloat(`${integer}.${decimals}`) || 0;
  }

  // 2. Standard cleanup for single strings
  let cleaned = text.replace(/[^\d.,]/g, '');

  if (includeDecimals) {
    // Standard format: "1.234,56" -> "1234.56"
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > -1) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/\./g, '');
    }
    return parseFloat(cleaned) || 0;
  } else {
    // Truncated format: "1.234,56" -> 1234
    const integerOnly = cleaned.split(',')[0].replace(/\./g, '');
    return parseInt(integerOnly, 10) || 0;
  }
}