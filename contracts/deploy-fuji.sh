#!/usr/bin/env bash
# Deploy APIritivoPayments to Avalanche Fuji and print the address to put in
# apps/web/.env.local as NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS.
#
# Deployer key: DEPLOYER_PRIVATE_KEY if set, otherwise the Arkiv writer key from
# apps/web/.env.local (testnet-only key, needs Fuji AVAX for gas:
# https://core.app/tools/testnet-faucet/).
set -euo pipefail
cd "$(dirname "$0")"
ENV_FILE="../apps/web/.env.local"
export AVALANCHE_FUJI_RPC_URL="${AVALANCHE_FUJI_RPC_URL:-$(grep -E '^AVALANCHE_FUJI_RPC_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2-)}"
export AVALANCHE_FUJI_RPC_URL="${AVALANCHE_FUJI_RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}"
export USDC_ADDRESS="${USDC_ADDRESS:-0x5425890298aed601595a70AB815c96711a31Bc65}"
export FEE_BPS="${FEE_BPS:-0}"
export SNOWTRACE_API_KEY="${SNOWTRACE_API_KEY:-}"
export DEPLOYER_PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY:-$(grep -E '^ARKIV_WRITER_PRIVATE_KEY=' "$ENV_FILE" | cut -d= -f2-)}"
[ -n "$DEPLOYER_PRIVATE_KEY" ] || { echo "No deployer key: set DEPLOYER_PRIVATE_KEY or ARKIV_WRITER_PRIVATE_KEY in $ENV_FILE"; exit 1; }
DEPLOYER=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
BAL=$(cast balance --rpc-url "$AVALANCHE_FUJI_RPC_URL" --ether "$DEPLOYER")
echo "deployer $DEPLOYER · balance $BAL AVAX · fee ${FEE_BPS} bps · usdc $USDC_ADDRESS"
if [ "$(echo "$BAL" | tr -d '.0')" = "" ]; then echo "Deployer has 0 AVAX. Fund it at https://core.app/tools/testnet-faucet/ then rerun."; exit 1; fi
forge script script/Deploy.s.sol:Deploy --rpc-url fuji --broadcast "$@"
ADDR=$(grep -o '"contractAddress": *"0x[0-9a-fA-F]\{40\}"' broadcast/Deploy.s.sol/43113/run-latest.json | head -1 | grep -o '0x[0-9a-fA-F]\{40\}')
echo
echo "APIritivoPayments deployed at: $ADDR"
echo "→ set NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS=$ADDR in apps/web/.env.local and restart bun dev"
echo "→ https://testnet.snowtrace.io/address/$ADDR"
