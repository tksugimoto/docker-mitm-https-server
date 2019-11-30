#!/bin/sh
set -ex

# HTTP_PROXY_SERVER_BIND_IP_PORT を読み込んでおく
# 変数定義としてvalidじゃない場合エラーになる点に注意
# source ./.env

curl \
    --cacert .generated/root.crt \
    --proxy ${HTTP_PROXY_SERVER_BIND_IP_PORT:-127.0.0.1:3128} \
    --include \
    --silent \
    --show-error \
    https://93.184.216.34:443/ \



# ※ 証明書検証はPASSするが、 server側のvirtual host関連で 404
