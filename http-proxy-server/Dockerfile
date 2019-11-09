FROM alpine:3.10

RUN apk add --update-cache --no-cache 'squid<5'

# TZ環境変数でタイムゾーンを変更できるようにするため
RUN apk add --update-cache --no-cache tzdata

# dig コマンド
RUN apk add --update-cache --no-cache bind-tools

WORKDIR /workdir
RUN chown squid:squid ./

CMD ["./start-proxy.sh"]

COPY --chown=squid:squid ./start-proxy.sh ./
RUN chmod 744 ./start-proxy.sh
