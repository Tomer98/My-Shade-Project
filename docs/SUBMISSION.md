# Smart Shade — פרטי הגשה

## שם הפרויקט

**Smart Shade** — מערכת אוטומציה ותחזוקה לקמפוס

## מגיש

| שם | ת״ז |
|---|---|
| תומר בראל | _(למלא בעותק המוגש)_ |

> מספר הזהות אינו נשמר במאגר הציבורי בכוונה. יש למלא אותו בעותק שמוגש למוסד.

## קישורים

| | |
|---|---|
| **מאגר קוד (GitHub)** | https://github.com/Tomer98/My-Shade-Project |
| **המערכת החיה** | https://my-shade-project.vercel.app |
| **מסלול הדגמה** | `docs/presentation-runbook-he.html` |

**כניסה להדגמה:** `Tom` / `password123`

## מוסד

מכון טכנולוגי חולון (HIT) — הפקולטה למדעים
מעבר על סמך מסמך הייזום **MaintControl** מאת מארק ישראל

---

## תוכן ההגשה

| קובץ | תיאור |
|---|---|
| `README.md` | תיעוד מלא — פיצ׳רים, 49 נקודות קצה, סכימה, פריסה |
| `docs/architecture-guide-he.html` | מדריך ארכיטקטורה בעברית, 16 פרקים |
| `docs/presentation-runbook-he.html` | מסלול הדגמה, רצף בדיקות ושאלות נפוצות |
| `docs/ONE_PAGER.md` | סיכום עמוד אחד |
| `smart_shade_architecture.svg` | דיאגרמת ארכיטקטורה |
| `server/database/schema.sql` | סכימת בסיס הנתונים (13 טבלאות) |
| `server/database/migrations/` | שלוש מיגרציות ממוספרות |
| קוד מקור | `client/` ו-`server/` במאגר |

## הרצה מקומית

```bash
git clone https://github.com/Tomer98/My-Shade-Project.git
cd My-Shade-Project

# להגדיר .env בשורש ו-server/.env (ראו .env.example)
docker compose up -d --build

cd client
npm install
npm run dev              # http://localhost:5173

# נתוני הדגמה
docker compose exec server node scripts/seed_demo.js
```

## בדיקות

```bash
cd server && npm test    # 89 בדיקות
cd client && npm test    # 12 בדיקות
```
