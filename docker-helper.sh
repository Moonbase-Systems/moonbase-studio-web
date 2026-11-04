#!/usr/bin/env bash

ENV="prod"
SERVICE="moonbase-studio-web"

if [[ "$1" == "dev" || "$1" == "prod" ]]; then
    ENV="$1"
    shift
fi

# --env-file makes NUXT_LAYER_GITHUB_TOKEN available to the production build
# secret. The token is not a build arg and is not written into the image.
if [[ "$ENV" == "dev" ]]; then
    COMPOSE_FILES="--env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml"
else
    COMPOSE_FILES="--env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml"
fi

usage() {
    echo "usage: $0 [dev|prod] --up [--attach] | --halt | --rebuild [--attach] | --destroy | --restart [--attach] | --attach | --logs"
    exit 1
}

attach() {
    docker compose $COMPOSE_FILES attach --sig-proxy=false "$SERVICE"
}

CMD="$1"
shift || true

ATTACH=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --attach)
            ATTACH=true
            ;;
        *)
            usage
            ;;
    esac
    shift
done

case "$CMD" in
    --up)
        docker compose $COMPOSE_FILES up --no-start
        docker compose $COMPOSE_FILES start
        ;;
    --halt)
        [[ "$ATTACH" == true ]] && usage
        docker compose $COMPOSE_FILES stop
        ;;
    --rebuild)
        docker compose $COMPOSE_FILES up -d --force-recreate --no-deps --build "$SERVICE"
        ;;
    --destroy)
        [[ "$ATTACH" == true ]] && usage
        docker compose $COMPOSE_FILES down --rmi local -v --remove-orphans
        ;;
    --restart)
        docker compose $COMPOSE_FILES restart
        ;;
    --attach)
        [[ "$ATTACH" == true ]] && usage
        attach
        ;;
    --logs)
        [[ "$ATTACH" == true ]] && usage
        docker compose $COMPOSE_FILES logs -f "$SERVICE"
        ;;
    *)
        usage
        ;;
esac

if [[ "$ATTACH" == true ]]; then
    attach
fi
