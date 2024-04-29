FROM node:20.12.2-alpine3.18

WORKDIR /usr/src/hub

COPY package*.json ./

RUN npm install

COPY . .
