"""
carrefour_scraper.py
---------------------------------------------------------------
סקריפט אופציונלי שאתה מריץ אצלך (לא רץ אצל Claude) כדי לייצר
קובץ products-db.js עם שמות ומחירים אמיתיים ועדכניים מקרפור אונליין,
במקום ההערכות הגסות שבקובץ המקורי.

למה סקריפט ולא סריקה אוטומטית מכאן?
- carrefour.co.il הוא אתר React/Vue שנטען לגמרי ב-JavaScript, אז
  requests+BeautifulSoup רגיל לא יראה שום מוצר — צריך דפדפן אמיתי (Playwright).
- קרפור עשוי לשנות מבנה HTML/class names בכל עדכון אתר, ומחירים
  ומבצעים משתנים תדיר — קובץ שנוצר היום יתיישן. מומלץ להריץ מדי פעם מחדש.
- שימוש הוגן: זה סקריפט לשימוש אישי בקצב איטי (sleep בין בקשות),
  לא לסריקה מסחרית. כדאי לבדוק את תנאי השימוש של האתר.

התקנה (חד פעמי):
    pip install playwright
    playwright install chromium

הרצה:
    python carrefour_scraper.py
    -> ייווצר קובץ products-db.generated.js באותה תיקייה.
    -> אפשר להחליף בו את products-db.js הקיים (לשמור גיבוי קודם).

הערה חשובה: ה-selectors (class names) למטה הם שלד לדוגמה בלבד.
כדי שזה יעבוד בפועל, פתח את carrefour.co.il בדפדפן, לחץ F12 (DevTools),
לחץ "בחר אלמנט" על כרטיס מוצר, ומצא את שם ה-class האמיתי של:
  1. כרטיס מוצר בודד (PRODUCT_CARD_SELECTOR)
  2. שם המוצר בתוך הכרטיס (PRODUCT_NAME_SELECTOR)
  3. המחיר בתוך הכרטיס (PRODUCT_PRICE_SELECTOR)
עדכן את שלושת המשתנים למטה בהתאם, ואז זה יעבוד.
"""

import json
import re
import time
from playwright.sync_api import sync_playwright

BASE_URL = "https://www.carrefour.co.il"
CATEGORIES_URL = f"{BASE_URL}/categories"

# TODO: עדכן לפי מה שתמצא ב-DevTools (ראה הסבר למעלה)
PRODUCT_CARD_SELECTOR = "[data-testid='product-card']"
PRODUCT_NAME_SELECTOR = "[data-testid='product-name']"
PRODUCT_PRICE_SELECTOR = "[data-testid='product-price']"
CATEGORY_LINK_SELECTOR = "a[href*='/categories/']"

# מיפוי בין שמות קטגוריות בקרפור לבין ה-id-ים שהאפליקציה מכירה
CATEGORY_ID_MAP = {
    "ירקות ופירות": "produce",
    "חלב, ביצים וסלטים": "dairy",
    "בשר עוף ודגים": "meat",
    "מאפים ולחם": "bakery",
    "קפואים": "frozen",
    "שימורים ורטבים": "cans",
    "אורז, פסטה וקטניות": "dry",
    "תבלינים ואפייה": "spices",
    "חטיפים וממתקים": "snacks",
    "משקאות": "drinks",
    "ניקיון": "clean",
    "טואלטיקה וקוסמטיקה": "toiletry",
}


def parse_price(text: str):
    m = re.search(r"(\d+(\.\d+)?)", text.replace(",", ""))
    return float(m.group(1)) if m else None


def scrape():
    products = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(locale="he-IL")
        page.goto(CATEGORIES_URL, wait_until="networkidle")
        time.sleep(2)

        category_links = page.eval_on_selector_all(
            CATEGORY_LINK_SELECTOR,
            "els => els.map(e => ({href: e.href, text: e.innerText}))"
        )
        seen_hrefs = set()

        for cat in category_links:
            href, label = cat["href"], cat["text"].strip()
            if href in seen_hrefs or not label:
                continue
            seen_hrefs.add(href)
            cat_id = CATEGORY_ID_MAP.get(label, "other")

            print(f"Scraping category: {label} -> {href}")
            page.goto(href, wait_until="networkidle")
            time.sleep(1.5)

            # גלילה כדי לטעון מוצרים ב-lazy load
            for _ in range(6):
                page.mouse.wheel(0, 2000)
                time.sleep(0.5)

            cards = page.query_selector_all(PRODUCT_CARD_SELECTOR)
            for card in cards:
                try:
                    name_el = card.query_selector(PRODUCT_NAME_SELECTOR)
                    price_el = card.query_selector(PRODUCT_PRICE_SELECTOR)
                    if not name_el or not price_el:
                        continue
                    name = name_el.inner_text().strip()
                    price = parse_price(price_el.inner_text())
                    if name and price:
                        products.append({
                            "name": name, "category": cat_id,
                            "unit": "יחידה", "price": price
                        })
                except Exception as e:
                    print("skip card:", e)

        browser.close()
    return products


def write_js(products, path="products-db.generated.js"):
    # הסרת כפילויות לפי שם
    seen = {}
    for p in products:
        seen[p["name"]] = p
    unique = list(seen.values())

    lines = [
        "// נוצר אוטומטית ע\"י carrefour_scraper.py — ניתן להחליף בו את products-db.js",
        "export const PRODUCTS = ["
    ]
    for p in unique:
        lines.append(
            f'  {{ name:{json.dumps(p["name"], ensure_ascii=False)}, '
            f'category:"{p["category"]}", unit:{json.dumps(p["unit"], ensure_ascii=False)}, '
            f'price:{p["price"]} }},'
        )
    lines.append("];")
    lines.append("")
    lines.append("""export function matchProduct(freeText){
  if(!freeText) return null;
  const clean = freeText.trim().toLowerCase();
  if(!clean) return null;
  let hit = PRODUCTS.find(p => p.name.toLowerCase() === clean);
  if(hit) return hit;
  hit = PRODUCTS.find(p => clean.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(clean));
  return hit || null;
}""")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Wrote {len(unique)} products to {path}")


if __name__ == "__main__":
    products = scrape()
    write_js(products)
