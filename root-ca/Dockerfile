FROM alpine:3.10

RUN apk add --update-cache --no-cache openssl

WORKDIR /root/

ENTRYPOINT ["./docker-entrypoint.sh"]

COPY ./docker-entrypoint.sh ./

RUN chmod u+x ./docker-entrypoint.sh
