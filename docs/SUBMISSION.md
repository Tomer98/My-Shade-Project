# Smart Shade — פרטי הגשה

**מערכת אוטומציה וניהול תחזוקה לקמפוס**

| | |
|---|---|
| **סטודנט** | תומר בראל |
| **ת״ז** | _(למלא בעותק המוגש)_ |
| **מנחה** | נתנאל זוהר |
| **מוסד** | מכון טכנולוגי חולון (HIT) — הפקולטה למדעים |
| **תואר** | B.Sc. מדעי המחשב |
| **תאריך** | ספטמבר 2026 |
| **מסמך ייזום** | MaintControl — מארק ישראל |

> מספר הזהות אינו נשמר במאגר הציבורי בכוונה. יש למלא אותו בעותק שמוגש למוסד.

---

## תוצרי ההגשה

| # | תוצר | קובץ |
|---|---|---|
| 1 | מצגת | `Smart-Shade-Presentation.pdf` — 24 שקופיות |
| 2 | מסמך פיתוח ובסיס מדעי | `Smart-Shade-Development-Document.pdf` — 17 עמודים |
| 3 | התוצר — קוד המקור | `Smart-Shade-Source-Code.zip` |
| 4 | פוסטר | `Smart-Shade-Poster.pdf` — עמוד אחד |
| 5 | סרטון הדגמה | _(להשלים קישור YouTube)_ |

## קישורים

| | |
|---|---|
| **מאגר קוד** | https://github.com/Tomer98/My-Shade-Project |
| **המערכת החיה** | https://my-shade-project.vercel.app |
| **סרטון הדגמה** | _(להשלים)_ |

---

## תוכן מאגר הקוד

| נתיב | תיאור |
|---|---|
| `client/` | לקוח React 19 — 21 רכיבים, i18n עברית/אנגלית |
| `client/android/` | פרויקט Capacitor לאנדרואיד, מאותו בסיס קוד |
| `server/` | שרת Node.js/Express — 10 בקרים, 5 שירותים, 49 נקודות קצה |
| `server/database/schema.sql` | סכימת בסיס הנתונים — 13 טבלאות (התקנה חדשה בלבד) |
| `server/database/migrations/` | שלוש מיגרציות ממוספרות (קידום מסד קיים) |
| `server/__tests__/` | 89 בדיקות — Jest ו-Supertest |
| `README.md` | תיעוד מלא: פיצ׳רים, נקודות קצה, סכימה, פריסה |
| `docs/ONE_PAGER.md` | סיכום עמוד אחד |
| `smart_shade_architecture.svg` | דיאגרמת ארכיטקטורה |
| `.github/workflows/ci.yml` | אינטגרציה רציפה — שתי סוויטות ובנייה מלאה |

## הרצה מקומית

```bash
git clone https://github.com/Tomer98/My-Shade-Project.git
cd My-Shade-Project

# להגדיר .env בשורש וב-server/ לפי server/.env.example
docker compose up -d --build

cd client
npm install
npm run dev              # http://localhost:5173
```

**נתוני הדגמה** — הסקריפט מדפיס בסיום את פרטי ההתחברות:

```bash
DEMO_PASSWORD=<בחר-סיסמה> docker compose exec server node scripts/seed_demo.js
```

**סימולטור חיישנים** — מזין טלמטריה לכל החדרים:

```bash
cd server
SIM_USER=<משתמש> SIM_PASS=<סיסמה> node scripts/multi_simulator.js
```

## בדיקות

```bash
cd server && npm test    # 89 בדיקות
cd client && npm test    # 12 בדיקות
```

---

## הערה על אבטחה

אין קבצי `.env`, מפתחות או סיסמאות במאגר או בקובץ ה-ZIP. קבצי `.env.example`
מתעדים את המשתנים הנדרשים ללא ערכים. סיסמת ההדגמה נקבעת בזמן ההרצה דרך
משתנה סביבה, ואם לא סופקה — נוצרת אקראית ומודפסת פעם אחת.
