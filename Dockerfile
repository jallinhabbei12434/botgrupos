FROM mcr.microsoft.com/playwright:v1.54.1-focal

# Cria o diretório do app
WORKDIR /usr/src/app

# Copia arquivos do projeto
COPY package*.json ./
RUN npm install

COPY . .

# Porta usada pelo app
ENV PORT=3000

# Comando de inicialização
CMD [ "node", "bot.js" ]
