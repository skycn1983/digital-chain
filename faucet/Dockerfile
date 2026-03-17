# Digital Chain Faucet Docker Image
FROM node:18-alpine

WORKDIR /app

COPY faucet/package*.json ./
RUN npm ci --only=production

COPY faucet/ .

EXPOSE 8081

CMD ["node", "faucet.js"]
