#!/bin/sh
set -ex

: Environment variable "TARGET_DOMAINS": ${TARGET_DOMAINS:?is not defined}

readonly root_key_dir=./.generated
readonly root_private_key_path=${root_key_dir}/root-key.pem
readonly root_cert_path=${root_key_dir}/root.crt
readonly root_serial_path=${root_key_dir}/root.srl

export server_key_dir=./.keys
mkdir -p $server_key_dir

readonly server_private_key_path=${server_key_dir}/server-key.pem
readonly server_cert_path=${server_key_dir}/server.crt
readonly server_san_path=${server_key_dir}/server_san.txt


# ", " が末尾についてしまうため、ダミードメインを最後に足す
echo "subjectAltName = $(printf -- "DNS:%s, " ${TARGET_DOMAINS}) DNS:_dummy_.example.com" > ${server_san_path}

# 秘密鍵の生成
openssl genrsa \
    -out ${server_private_key_path} \

# CSR, 証明書の生成
openssl req \
    -new \
    -key ${server_private_key_path} \
    -subj "/O=MITM HTTPS SERVER" \
| openssl x509 \
    -req \
    -CAkey ${root_private_key_path} \
    -CA ${root_cert_path} \
    -CAserial ${root_serial_path} \
    -CAcreateserial \
    -extfile ${server_san_path} \
    -out ${server_cert_path} \

# start https server
node index.js
