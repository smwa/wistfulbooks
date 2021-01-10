#!/bin/bash
CONTAINER_NAME=wistfulbooks
CONTAINER_IMAGE="nginx:stable-alpine"
docker pull $CONTAINER_IMAGE
docker stop $CONTAINER_NAME
docker rm $CONTAINER_NAME
docker run -d --name $CONTAINER_NAME -p 5989:80 -v `pwd`:/usr/share/nginx/html:ro $CONTAINER_IMAGE
echo "Running on http://localhost:5989/"
