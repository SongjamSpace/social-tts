#!/usr/bin/env bash
# Build the OpenClaw agent image for linux/amd64 (required by DigitalOcean App Platform).
# Usage: ./build-for-do.sh [image:tag]
# Example: ./build-for-do.sh adamsongjam/openclaw-agent:latest
# Or set OPENCLAW_AGENT_IMAGE and run: ./build-for-do.sh

set -e
IMAGE="${1:-${OPENCLAW_AGENT_IMAGE:-your-dockerhub-username/openclaw-agent:latest}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building for linux/amd64: $IMAGE"
docker buildx build --platform linux/amd64 -t "$IMAGE" .
echo "Push with: docker push $IMAGE"
