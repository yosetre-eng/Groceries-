# הרשימה שלנו 🛒

רשימת קניות משותפת ליוסף ואגם — מחולקת לפי קטגוריות, מסונכרנת בזמן אמת, עם תקציב משוער, היסטוריה וסטטיסטיקה.

## מה יש באפליקציה

- **רשימה משותפת בזמן אמת** מחולקת ל-13 קטגוריות, מסונכרנת בין שני המכשירים דרך Firestore.
- **סדר קטגוריות לפי מעבר בסופר** — חצי ▲▼ ליד כל קטגוריה מזיזים אותה למעלה/למטה, והסדר נשמר משותף לשניכם.
- **פריטים מהירים** — שורת צ'יפים מעל טופס ההוספה, עם הפריטים שאתם קונים הכי הרבה ועדיין לא ברשימה. לחיצה מוסיפה מיד.
- **השלמה אוטומטית** — הקלדה בשדה השם מציעה מוצרים מתוך בסיס הנתונים (`products-db.js`), וממלאת אוטומטית קטגוריה ומחיר משוער.
- **תקציב משוער** — סכום כולל (₪) מוצג ליד סרגל ההתקדמות.
- **הוספה ממתכון** — כפתור 📖 בכותרת. מדביקים רשימת רכיבים (שורה לרכיב), האפליקציה מזהה כמות ומשייכת לקטגוריה, ואתם מאשרים לפני הוספה.
- **סטטיסטיקה** — כפתור 📊 מציג את 10 המוצרים שנקנים הכי הרבה, לפי היסטוריית קניות אמיתית.
- **היסטוריית קניות** — "נקו פריטים שנקנו" מעביר פריטים לארכיון (`history`) במקום למחוק אותם סתם — משם ניזונות גם הסטטיסטיקה וגם "פריטים מהירים".
- **מצב אופליין** — Firestore persistent cache מאפשר להוסיף פריטים גם בלי אינטרנט בסופר, והסנכרון קורה כשהרשת חוזרת.

## הקמה (פרויקט Firebase: groceries-b1f9f)

1. ודאו ש-Firestore Database קיים (Build → Firestore Database → Create database, אם עדיין לא).
2. ב-Rules הדביקו (מכסה items, history ו-meta):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /items/{itemId} { allow read, write: if true; }
       match /history/{docId} { allow read, write: if true; }
       match /meta/{docId} { allow read, write: if true; }
     }
   }
   ```
   ולחצו **Publish**.
3. פרטי ה-Firebase כבר מוזנים בתוך `app.js`.

## פריסה ל-GitHub Pages

1. ריפו, למשל `yosetre-eng/Shopping-list`.
2. העלו: `index.html`, `app.js`, `products-db.js`, `manifest.json`, `sw.js`, `README.md`. (`carrefour_scraper.py` לא צריך להעלות — הוא רץ אצלכם במחשב, לא באתר.)
3. Settings → Pages → Deploy from branch → `main` / root.
4. הוספה למסך הבית מהדפדפן להתקנה כ-PWA.

## מחירי קרפור — מה עשיתי ומה לא

לא הצלחתי לסרוק את כל קטלוג קרפור אוטומטית מפה: `carrefour.co.il` הוא אתר שנטען לגמרי ב-JavaScript (SPA), אין תוכן קבוע לקרוא בלי דפדפן אמיתי שמריץ אותו. גם אם הייתי יכול — אלפי מוצרים עם מחירים ומבצעים שמשתנים כל הזמן, כך שקובץ סטטי היה מתיישן תוך ימים.

מה שכן עשיתי: `products-db.js` מכיל כ-90 מוצרי סופר נפוצים עם **מחירים משוערים** (לא scrape חי, מסומן בבירור בראש הקובץ) — מספיק לתקציב גס ולזיהוי קטגוריה אוטומטי.

כדי לקבל שמות ומחירים **מדויקים בדיוק כמו בקרפור**, כדי שאגם תזהה בדיוק את המוצר שהבאת: צירפתי `carrefour_scraper.py` — סקריפט Python+Playwright שאתה מריץ אצלך. הוא דורש שתפתח את carrefour.co.il ב-DevTools ותמצא את שמות ה-class הנכונים (מוסבר בראש הקובץ), כי אלה עלולים להשתנות בעדכוני אתר. אחרי הרצה הוא מייצא `products-db.generated.js` באותו פורמט בדיוק — מחליפים בו את `products-db.js`.

## קיצור iOS Shortcuts — הוספת פריט בלי לפתוח את האפליקציה

בדומה לקיצורים שבנית למזגן: שולחים פריט ישירות ל-Firestore, בלי Cloud Function, כי הכללים פתוחים לכתיבה.

1. **Ask for Input** (Text) — "מה חסר?"
2. **Format Date** (Current Date) — ISO 8601
3. **Get Contents of URL**:
   - URL: `https://firestore.googleapis.com/v1/projects/groceries-b1f9f/databases/(default)/documents/items`
   - Method: `POST`
   - Headers: `Content-Type: application/json`
   - Request Body (JSON):
     ```json
     {
       "fields": {
         "name": { "stringValue": "[Provided Input]" },
         "category": { "stringValue": "other" },
         "done": { "booleanValue": false },
         "addedBy": { "stringValue": "יוסף" },
         "createdAt": { "timestampValue": "[Formatted Date]" },
         "qty": { "integerValue": "1" }
       }
     }
     ```
     (מחליפים את הסוגריים המרובעים במשתני Shortcuts המתאימים.)
4. **Show Notification** — "נוסף לרשימה 🛒"

אפשר להוסיף למסך הבית או ל-Siri ("תוסיף לרשימה"). קטגוריה תמיד תהיה "שונות" בדרך הזו (אין השלמה אוטומטית מחוץ לאפליקציה) — אפשר לתקן בתוך האפליקציה אחר כך.

## מה עדיין לא בפנים (בכוונה, לפי הבקשה)
- "מי בקניות עכשיו"
- התראות Push
