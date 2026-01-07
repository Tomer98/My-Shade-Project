# שימוש בגרסת Node קלה ורשמית
FROM node:18-alpine

# יצירת תיקיית עבודה בתוך הקונטיינר
WORKDIR /app

# העתקת קבצי ההגדרות (כדי לנצל את ה-Cache של Docker)
COPY package*.json ./

# התקנת הספריות
RUN npm install

# העתקת כל שאר הקוד
COPY . .

# חשיפת הפורט של השרת
EXPOSE 3001

# הפקודה להרצת השרת
CMD ["npm", "start"]