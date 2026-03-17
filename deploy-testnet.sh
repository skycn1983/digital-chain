#!/bin/bash

# Digital Chain Testnet Quick Deploy Script
# Usage: ./deploy-testnet.sh [options]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
COMPOSE_FILE="docker-compose.testnet.yml"
ENV_FILE=".env.testnet"
FAUCET_ADDRESS=""
FAUCET_KEY=""
BUILD=false
DETACHED=true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --build|-b)
      BUILD=true
      shift
      ;;
    --foreground|-f)
      DETACHED=false
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --build, -b      Build images before starting"
      echo "  --foreground, -f Run in foreground (no -d)"
      echo "  --help, -h       Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                    # Start testnet in background"
      echo "  $0 --build           # Build and start in background"
      echo "  $0 -f                # Start in foreground"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🚀 Digital Chain Testnet Deploy Script${NC}"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker is not installed${NC}"
  exit 1
fi

if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}❌ Docker Compose is not installed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"
echo ""

# Check if .env.testnet exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}⚠️  $ENV_FILE not found${NC}"
  echo "Creating from example..."
  cp .env.testnet.example .env.testnet
  echo ""
  echo -e "${YELLOW}📝 Please edit .env.testnet and set:${NC}"
  echo "   - FAUCET_ADDRESS (required)"
  echo "   - FAUCET_KEY (required)"
  echo ""
  read -p "Press Enter after editing .env.testnet..."
fi

# Load environment variables
if [ -f "$ENV_FILE" ]; then
  export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
fi

# Validate required variables
if [ -z "$FAUCET_ADDRESS" ] || [ "$FAUCET_ADDRESS" = "your-faucet-address-here" ]; then
  echo -e "${RED}❌ FAUCET_ADDRESS is not set in $ENV_FILE${NC}"
  exit 1
fi

if [ -z "$FAUCET_KEY" ] || [ "$FAUCET_KEY" = "your-private-key-here" ]; then
  echo -e "${RED}❌ FAUCET_KEY is not set in $ENV_FILE${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Environment validated${NC}"
echo ""

# Build if requested
if [ "$BUILD" = true ]; then
  echo "Building Docker images..."
  docker-compose -f "$COMPOSE_FILE" build
  echo ""
fi

# Stop existing services
echo "Stopping any existing testnet services..."
docker-compose -f "$COMPOSE_FILE" down 2>/dev/null || true
echo ""

# Start services
echo "Starting Digital Chain testnet..."
if [ "$DETACHED" = true ]; then
  docker-compose -f "$COMPOSE_FILE" up -d
  echo ""
  echo -e "${GREEN}✅ Testnet started in background${NC}"
  echo ""
  echo "Services:"
  echo "  🌐 Node1 API:  http://localhost:3000"
  echo "  🌐 Node2 API:  http://localhost:3002"
  echo "  🌐 Node3 API:  http://localhost:3004"
  echo "  💧 Faucet:     http://localhost:8081"
  echo ""
  echo "Commands:"
  echo "  View logs:    docker-compose -f $COMPOSE_FILE logs -f"
  echo "  Stop:         ./deploy-testnet.sh --stop"
  echo "  Restart:      docker-compose -f $COMPOSE_FILE restart"
  echo ""
else
  docker-compose -f "$COMPOSE_FILE" up
fi

# Wait for health checks
echo ""
echo "Waiting for services to become healthy..."
sleep 10

# Check health
echo ""
echo "Checking health..."
NODE1_HEALTH=$(curl -s http://localhost:3000/health || echo "error")
if echo "$NODE1_HEALTH" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✅ Node1 is healthy${NC}"
else
  echo -e "${YELLOW}⚠️  Node1 not ready yet, check logs${NC}"
fi

FAUCET_HEALTH=$(curl -s http://localhost:8081/health || echo "error")
if echo "$FAUCET_HEALTH" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✅ Faucet is healthy${NC}"
else
  echo -e "${YELLOW}⚠️  Faucet not ready yet, check logs${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Testnet deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the network: curl http://localhost:3000/health"
echo "2. Open faucet: http://localhost:8081"
echo "3. Read documentation: docs/deployment/testnet-deployment.md"
