FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate

EXPOSE 3000

# Default to the production server; compose overrides this for local dev (nodemon).
CMD ["npm", "start"]
