/* =========================================================
   בסיס נתוני מוצרים
   ---------------------------------------------------------
   המחירים כאן הם הערכות גסות (לא סריקה חיה של קרפור) שנועדו
   לתת סדר גודל לתקציב ולתת להשלמה האוטומטית שם מוצר אחיד וברור.
   אפשר לערוך/להוסיף שורות ידנית, או להריץ את carrefour_scraper.py
   ולהחליף קובץ זה בפלט שלו לקבלת שמות ומחירים מדויקים מקרפור.
   כל שורה: { name, category, unit, price }
   ========================================================= */
export const PRODUCTS = [
  // ירקות ופירות - produce
  { name:"עגבניות", category:"produce", unit:"ק\"ג", price:6.9 },
  { name:"מלפפונים", category:"produce", unit:"ק\"ג", price:5.9 },
  { name:"בצל יבש", category:"produce", unit:"ק\"ג", price:3.9 },
  { name:"תפוחי אדמה", category:"produce", unit:"ק\"ג", price:4.9 },
  { name:"גזר", category:"produce", unit:"ק\"ג", price:4.5 },
  { name:"פלפל צבעוני", category:"produce", unit:"ק\"ג", price:9.9 },
  { name:"בננות", category:"produce", unit:"ק\"ג", price:6.9 },
  { name:"תפוחים", category:"produce", unit:"ק\"ג", price:8.9 },
  { name:"לימון", category:"produce", unit:"ק\"ג", price:6.9 },
  { name:"אבוקדו", category:"produce", unit:"יחידה", price:4.9 },
  { name:"שום", category:"produce", unit:"יחידה", price:3.5 },
  { name:"חסה", category:"produce", unit:"יחידה", price:5.9 },
  { name:"קישואים", category:"produce", unit:"ק\"ג", price:5.9 },

  // מוצרי חלב וביצים - dairy
  { name:"חלב 3%", category:"dairy", unit:"ליטר", price:6.9 },
  { name:"ביצים L", category:"dairy", unit:"מארז 12", price:15.9 },
  { name:"גבינה צהובה", category:"dairy", unit:"500 גרם", price:22.9 },
  { name:"קוטג'", category:"dairy", unit:"250 גרם", price:5.9 },
  { name:"גבינה לבנה 5%", category:"dairy", unit:"250 גרם", price:7.9 },
  { name:"יוגורט", category:"dairy", unit:"יחידה", price:3.9 },
  { name:"חמאה", category:"dairy", unit:"200 גרם", price:8.9 },
  { name:"שמנת מתוקה", category:"dairy", unit:"250 מ\"ל", price:8.5 },
  { name:"גבינת שמנת", category:"dairy", unit:"250 גרם", price:9.9 },

  // בשר עוף ודגים - meat
  { name:"חזה עוף", category:"meat", unit:"ק\"ג", price:39.9 },
  { name:"שניצל עוף", category:"meat", unit:"ק\"ג", price:44.9 },
  { name:"בשר טחון", category:"meat", unit:"ק\"ג", price:59.9 },
  { name:"נקניקיות", category:"meat", unit:"חבילה", price:19.9 },
  { name:"סלמון", category:"meat", unit:"ק\"ג", price:79.9 },
  { name:"טונה קפואה", category:"meat", unit:"ק\"ג", price:59.9 },
  { name:"כרעיים עוף", category:"meat", unit:"ק\"ג", price:24.9 },

  // מאפים ולחם - bakery
  { name:"לחם פרוס", category:"bakery", unit:"יחידה", price:9.9 },
  { name:"פיתות", category:"bakery", unit:"חבילה", price:8.9 },
  { name:"בגטים", category:"bakery", unit:"יחידה", price:7.9 },
  { name:"חלה", category:"bakery", unit:"יחידה", price:14.9 },
  { name:"לחמניות", category:"bakery", unit:"חבילה", price:12.9 },

  // קפואים - frozen
  { name:"ירקות קפואים", category:"frozen", unit:"800 גרם", price:12.9 },
  { name:"אפונה קפואה", category:"frozen", unit:"800 גרם", price:10.9 },
  { name:"צ'יפס קפוא", category:"frozen", unit:"ק\"ג", price:14.9 },
  { name:"פיצה קפואה", category:"frozen", unit:"יחידה", price:19.9 },
  { name:"בורקס קפוא", category:"frozen", unit:"חבילה", price:16.9 },

  // שימורים ורטבים - cans
  { name:"טונה בשימורים", category:"cans", unit:"יחידה", price:6.9 },
  { name:"תירס בשימורים", category:"cans", unit:"יחידה", price:5.9 },
  { name:"עגבניות מרוסקות", category:"cans", unit:"יחידה", price:5.5 },
  { name:"רסק עגבניות", category:"cans", unit:"יחידה", price:4.9 },
  { name:"קטשופ", category:"cans", unit:"750 גרם", price:9.9 },
  { name:"מיונז", category:"cans", unit:"500 גרם", price:9.9 },
  { name:"חומוס מוכן", category:"cans", unit:"400 גרם", price:9.9 },
  { name:"טחינה גולמית", category:"cans", unit:"500 גרם", price:14.9 },

  // אורז, פסטה וקטניות - dry
  { name:"אורז", category:"dry", unit:"ק\"ג", price:8.9 },
  { name:"פסטה", category:"dry", unit:"500 גרם", price:6.9 },
  { name:"קוסקוס", category:"dry", unit:"500 גרם", price:8.9 },
  { name:"עדשים", category:"dry", unit:"ק\"ג", price:9.9 },
  { name:"קמח לבן", category:"dry", unit:"ק\"ג", price:5.9 },

  // תבלינים ואפייה - spices
  { name:"מלח", category:"spices", unit:"יחידה", price:3.9 },
  { name:"סוכר", category:"spices", unit:"ק\"ג", price:5.9 },
  { name:"שמן קנולה", category:"spices", unit:"ליטר", price:9.9 },
  { name:"שמן זית", category:"spices", unit:"750 מ\"ל", price:27.9 },
  { name:"אבקת אפייה", category:"spices", unit:"יחידה", price:4.9 },
  { name:"פלפל שחור", category:"spices", unit:"יחידה", price:12.9 },
  { name:"פפריקה", category:"spices", unit:"יחידה", price:9.9 },

  // חטיפים וממתקים - snacks
  { name:"במבה", category:"snacks", unit:"יחידה", price:6.9 },
  { name:"ביסלי", category:"snacks", unit:"יחידה", price:6.9 },
  { name:"שוקולד", category:"snacks", unit:"יחידה", price:8.9 },
  { name:"עוגיות", category:"snacks", unit:"חבילה", price:11.9 },
  { name:"פופקורן", category:"snacks", unit:"חבילה", price:9.9 },

  // משקאות - drinks
  { name:"מים מינרלים", category:"drinks", unit:"שישייה 1.5 ליטר", price:11.9 },
  { name:"קולה", category:"drinks", unit:"1.5 ליטר", price:9.9 },
  { name:"מיץ תפוזים", category:"drinks", unit:"ליטר", price:13.7 },
  { name:"בירה", category:"drinks", unit:"שישייה", price:34.9 },
  { name:"קפה נמס", category:"drinks", unit:"200 גרם", price:24.9 },
  { name:"תה", category:"drinks", unit:"חבילה", price:12.9 },

  // ניקיון - clean
  { name:"נוזל כלים", category:"clean", unit:"יחידה", price:9.9 },
  { name:"אקונומיקה", category:"clean", unit:"יחידה", price:6.9 },
  { name:"אבקת כביסה", category:"clean", unit:"יחידה", price:29.9 },
  { name:"מרכך כביסה", category:"clean", unit:"יחידה", price:14.9 },
  { name:"שקיות אשפה", category:"clean", unit:"מארז", price:12.9 },
  { name:"נייר סופג", category:"clean", unit:"מארז", price:16.9 },
  { name:"ספוגים", category:"clean", unit:"חבילה", price:8.9 },

  // טואלטיקה וקוסמטיקה - toiletry
  { name:"נייר טואלט", category:"toiletry", unit:"מארז 24", price:34.9 },
  { name:"סבון ידיים", category:"toiletry", unit:"יחידה", price:9.9 },
  { name:"שמפו", category:"toiletry", unit:"יחידה", price:19.9 },
  { name:"משחת שיניים", category:"toiletry", unit:"יחידה", price:12.9 },
  { name:"דאודורנט", category:"toiletry", unit:"יחידה", price:16.9 },

  // שונות - other
  { name:"מגבונים לתינוק", category:"other", unit:"חבילה", price:14.9 },
  { name:"סוללות", category:"other", unit:"מארז", price:19.9 },
];

/** מציאת מוצר מתאים לפי שם חופשי (התאמה חלקית, לא תלוית ניקוד/רווחים) */
export function matchProduct(freeText){
  if(!freeText) return null;
  const clean = freeText.trim().toLowerCase();
  if(!clean) return null;
  // exact match first
  let hit = PRODUCTS.find(p => p.name.toLowerCase() === clean);
  if(hit) return hit;
  // substring match either direction
  hit = PRODUCTS.find(p => clean.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(clean));
  return hit || null;
}
