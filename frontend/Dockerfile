# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build Vite application for production (uses relative API paths via Nginx)
ENV VITE_SERVER_URL=""
RUN npm run build

# Production web server stage
FROM nginx:alpine

# Copy built frontend assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration with reverse proxy for /api/
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
