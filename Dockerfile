FROM alpine:edge

WORKDIR /app

COPY . ./

RUN apk update && \
apk add nodejs npm ffmpeg

RUN npm install && \
npm run build

EXPOSE 34400

CMD ["npm", "start"]