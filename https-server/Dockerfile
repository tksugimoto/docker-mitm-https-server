FROM node:10-alpine

RUN apk add --update-cache --no-cache openssl

RUN apk add --update-cache --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# TZ環境変数でタイムゾーンを変更できるようにするため
RUN apk --update --no-cache add tzdata

WORKDIR /root/

CMD ["./start.sh"]

COPY [ \
    "index.js", \
    "start.sh", \
    "./"]
