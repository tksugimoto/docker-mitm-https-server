#!/bin/sh
set -e

readonly root_key_dir=./.generated

readonly root_private_key_path=${root_key_dir}/root-key.pem
readonly root_cert_path=${root_key_dir}/root.crt

# 秘密鍵の生成
openssl genrsa \
    -out $root_private_key_path \

# CSR, 証明書の生成
openssl req \
    -new \
    -key $root_private_key_path \
    -subj "/CN=${ROOT_CERT_COMMON_NAME:-Private CA}" \
    -x509 \
    -days ${ROOT_CERT_LIFETIME_DAYS:-30} \
    -out $root_cert_path \
