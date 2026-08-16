FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.js chat.html contoso-e.png ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
