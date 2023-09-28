FROM node:lts-alpine as development
WORKDIR /usr/src/app 
COPY package*.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:lts-alpine as production
ARG NODE_ENV=production
WORKDIR /usr/src/app
COPY package*.json .
RUN npm ci --omit=dev
COPY --from=development /usr/src/app/dist ./dist
EXPOSE 21
EXPOSE 65500-65515
ENV PASV_HOSTNAME="127.0.0.1"

CMD ["node", "dist/index.js"]

