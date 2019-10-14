#!/bin/sh
set -ex

# 第一引数を渡した場合、ROOT証明書の「発行先」・「発行者」を変更できる
export ROOT_CERT_COMMON_NAME=$1

export COMPOSE_FILE="docker-compose.generate-root.yml"

docker-compose build

docker-compose run --rm root-ca

# root.crt, root-key.pem の生成確認
ls -l ./.generated/
