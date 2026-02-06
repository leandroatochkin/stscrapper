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

  console.log(`[Debug] Input Prov: "${province}" | Cleaned: "${rawProv}" | Final: "${normalizedProv}"`);

  const availableStores: string[] = [];

  Object.entries(storesData).forEach(([storeKey, config]: [string, any]) => {
    const isNational = config.provinces.includes("ALL");
    const isProvincial = config.provinces.includes(normalizedProv);
    const isCitySpecific = config.major_cities?.includes(normalizedCity);

    if (isNational || isProvincial || isCitySpecific) {
      availableStores.push(storeKey);
    }
  });

  console.log(`[Debug] Stores found: ${availableStores.join(', ')}`);
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