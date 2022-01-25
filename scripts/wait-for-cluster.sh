#!/usr/bin/env sh

set -ex

max_retry=30
counter=0

function pingRedis() {
  echo "Verifying pingRedis ${counter}/${max_retry}"
  echo "CLUSTER INFO" | nc $1 $2 2>/dev/null | grep cluster_state:ok > /dev/null
  if [ $? -eq 0 ]
  then
    return 0
  else
    return 1
  fi
}

until pingRedis 'redis-cluster' '7000' && pingRedis 'redis-cluster' '7001' && pingRedis 'redis-cluster' '7002'
do
  sleep 1
  [[ $counter -eq $max_retry ]] && echo "Failed!" && exit 1
  counter=`expr $counter + 1`
done

# first arg is `-f` or `--some-option`
if [ "${1#-}" != "$1" ]; then
	set -- node "$@"
fi

exec "$@"
