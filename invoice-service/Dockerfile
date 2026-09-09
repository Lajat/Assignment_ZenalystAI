FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json ./
RUN npm install --production

COPY index.js ./

# curl needed for the docker-compose healthcheck
RUN apk add --no-cache curl

EXPOSE 3000
CMD ["node", "index.js"]
