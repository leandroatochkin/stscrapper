import { chromium } from "playwright";
import { extractBrand } from "../utils/brandMapper";

const BASE_URL = "https://diaonline.supermercadosdia.com.ar";

export async function scrapeDia(query: string) {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 60,
  });

  const page = await browser.newPage();

  await page.goto(BASE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForTimeout(4000);

  const searchInput = await page.waitForSelector(
    'input[placeholder*="Buscar"]',
    { timeout: 15000 }
  );



  await searchInput.fill("");
  await searchInput.type(query, { delay: 120 });
  await searchInput.press("Enter");

  await page.waitForSelector(
    ".vtex-product-summary-2-x-container",
    { timeout: 20000 }
  );

  await page.waitForTimeout(3000);

  const products = await page.$$eval(
    ".vtex-product-summary-2-x-container",
    cards =>
      cards.slice(0, 5).map(card => {

        const name =
          card.querySelector(
            ".vtex-product-summary-2-x-productNameContainer"
          )?.textContent?.trim() ?? "";

        const priceText =
          card.querySelector('[class*="sellingPrice"]')
            ?.textContent ||
          card.querySelector('[class*="price"]')
            ?.textContent || "";

        const price = Number(
          priceText
            .replace(/\./g, "")
            .replace(/[^0-9]/g, "")
        );

        const relativeLink =
          card.querySelector("a")?.getAttribute("href") ?? "";

        const link = relativeLink.startsWith("http")
          ? relativeLink
          : `https://diaonline.supermercadosdia.com.ar${relativeLink}`;

        return { name, price, link };
      })
  );

  await browser.close();

  return products;

}