#!/bin/sh
set -e

display_usage() {
    echo "Usage: $0 [ROOT_CERT_COMMON_NAME] [ROOT_CERT_LIFETIME_DAYS]"
    echo 'Generate root certificate'
    echo ''
    echo '  ROOT_CERT_COMMON_NAME   : (default) "Private CA"'
    echo '  ROOT_CERT_LIFETIME_DAYS : (default) 30 days'
}

if [[ $1 == -* ]] || [[ $1 == help ]] ; then
    display_usage
    exit 1
fi

set -ex

# 第一引数を渡した場合、ROOT証明書の「発行先」・「発行者」を変更できる
export ROOT_CERT_COMMON_NAME=$1

# 第二引数を渡した場合、ROOT証明書の「有効期限」を変更できる (単位: 日)
export ROOT_CERT_LIFETIME_DAYS=$2

export COMPOSE_PATH_SEPARATOR=","
export COMPOSE_FILE="docker-compose.generate-root.yml,docker-compose.yml"

docker-compose build root-ca

docker-compose run --rm root-ca

# root.crt の生成確認
ls -l ./.generated/
