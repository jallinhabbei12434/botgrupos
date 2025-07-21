FROM mcr.microsoft.com/playwright:focal

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
