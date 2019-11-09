#!/bin/sh
set -e

route add -host ${TARGET_IP} gw $(dig +short ${FORWARDING_CONTAINER}) eth0

route -n

echo Generate squid.conf
echo ========================

cat <<- EOS | tee ./squid.conf
	# route設定のためにuserを変更したためログを標準出力に出せない
	access_log none

	http_port 3128

	# Avoid pid creation error when launching by squid user
	pid_filename none

	# To reduce wait time at stop
	shutdown_lifetime 1 seconds

	http_access allow all
EOS

echo ========================

echo
echo Proxy started

# -N: No daemon mode.
exec squid -f ./squid.conf -N
