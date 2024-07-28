FROM node:18

WORKDIR /app

COPY . ./

RUN npm install && \
npm run build

EXPOSE 34400

CMD ["npm", "start"]