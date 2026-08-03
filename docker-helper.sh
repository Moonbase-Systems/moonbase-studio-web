#!/usr/bin/env bash

ENV="prod"

if [[ "$1" == "dev" || "$1" == "prod" ]]; then
    ENV="$1"
    shift
fi


if [[ "$ENV" == "dev" ]]; then
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml"
else
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
fi

usage() {
    echo "usage: $0 [dev|prod] --up | --halt | --rebuild | --destroy"
    exit 1
}

case "$1" in
    --up)
        docker compose $COMPOSE_FILES up --no-start
        docker compose $COMPOSE_FILES start
        docker compose attach moonbase-studio-web
        ;;
    --halt)
        docker compose $COMPOSE_FILES stop
        ;;
    --rebuild)
        docker compose $COMPOSE_FILES up -d --force-recreate --no-deps --build moonbase-studio-web
        docker compose attach moonbase-studio-web
        ;;
    --destroy)
        docker compose $COMPOSE_FILES down --rmi local -v --remove-orphans
        ;;
    --restart)
        docker compose $COMPOSE_FILES restart
        docker compose attach moonbase-studio-web
        ;;
    *)
        usage
        ;;
esac
