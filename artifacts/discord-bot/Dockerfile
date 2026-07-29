FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=8192"

CMD ["node", "--dns-result-order=ipv4first", "src/index.js"]
