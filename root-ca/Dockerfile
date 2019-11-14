FROM alpine:3.10

RUN apk add --update-cache --no-cache openssl

WORKDIR /root/

COPY ./docker-entrypoint.sh ./

RUN chmod u+x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
