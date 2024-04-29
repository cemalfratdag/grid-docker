FROM mcr.microsoft.com/playwright:v1.43.0-jammy

WORKDIR /usr/src/node

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4000
