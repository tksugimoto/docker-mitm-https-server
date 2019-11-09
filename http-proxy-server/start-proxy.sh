#!/bin/sh
set -e

echo Generate squid.conf
echo ========================

cat <<- EOS | tee ./squid.conf
	# logformat
	# tl: Local time
	# >a: Client source IP address
	# un: User name (any available)
	# >Hs: HTTP status code sent to the client
	# rm: Request method (GET/POST etc)
	# ru: Request URL received (or computed) and sanitized
	# rv: Request protocol version
	# >h: Original received request header
	logformat custom   [%{%Y/%m/%d %H:%M:%S %z}tl] %>a %[un [%>Hs] "%rm %ru HTTP/%rv" "%{User-Agent}>h"
	access_log stdio:/dev/stdout custom

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
