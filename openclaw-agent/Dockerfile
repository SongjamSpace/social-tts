# Build for linux/amd64 so the image runs on DigitalOcean App Platform (e.g. docker buildx build --platform linux/amd64 -t user/openclaw-agent:latest .)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
