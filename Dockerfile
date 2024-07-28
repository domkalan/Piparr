FROM node:18

ADD . /app

RUN npm install && \
npm run build

WORKDIR /app

EXPOSE 34400

CMD node /app/dist/index.js