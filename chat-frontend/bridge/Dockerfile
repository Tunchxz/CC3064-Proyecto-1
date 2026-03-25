FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY bridge.js .
EXPOSE 4000
CMD ["node", "bridge.js"]
