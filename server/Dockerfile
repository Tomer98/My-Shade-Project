# 1. Base Image
FROM node:18-alpine

# 2. Working Directory
WORKDIR /app

# 3. Dependencies
COPY package*.json ./
RUN npm install

# 4. Source Code
COPY . .

# 5. Port Expose
EXPOSE 3001

# 6. Execution
CMD ["npm", "start"]