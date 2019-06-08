#!/bin/bash
CONTAINER_NAME=wistfulbooks
docker pull nginx:stable-alpine
docker stop $CONTAINER_NAME
docker rm $CONTAINER_NAME
docker run -d --name $CONTAINER_NAME -p 5989:80 -v `pwd`:/usr/share/nginx/html:ro nginx:stable-alpine
echo "Running on http://localhost:5989/"
