# Dockerfile pour GraphQL Gateway
FROM node:20-alpine

# Répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install --production

# Copier tout le code
COPY . .

# Exposer le port
EXPOSE 4000

# Start command
CMD ["node", "src/index.js"]
