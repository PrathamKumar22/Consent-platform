FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source
COPY src/ ./src/
COPY opa/ ./opa/
COPY .env* ./

EXPOSE 5000

CMD ["node", "src/index.js"]
