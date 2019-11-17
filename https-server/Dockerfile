FROM node:12.13-alpine

RUN apk add --update-cache --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# TZ環境変数でタイムゾーンを変更できるようにするため
RUN apk add --update-cache --no-cache tzdata

WORKDIR /root/

RUN apk add --update-cache --no-cache openssl

CMD ["./start.sh"]

COPY [ \
    "index.js", \
    "start.sh", \
    "./"]

RUN chmod u+x ./start.sh
