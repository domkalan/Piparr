FROM node:24

WORKDIR /app

COPY . ./

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
apt-get -y --no-install-recommends install ffmpeg && \
rm -rf /var/lib/apt/lists/* && \
npm install && \
npm run build

EXPOSE 34400

CMD ["npm", "start"]