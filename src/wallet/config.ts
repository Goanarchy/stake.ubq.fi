import { mainnet, anvil, type Chain } from "viem/chains";
import { fallback } from "viem";
import { createConfig, http, injected, type Transport } from "wagmi";
import { getChainRpcUrl, isLocalNode, RPC_FALLBACK_URLS, RPC_URL } from "../constants/config";
import { getResolvedRpcBaseUrl } from "../utils/rpc-runtime";

export { getChainRpcUrl };

export const supportedChains: readonly [Chain, ...Chain[]] = isLocalNode ? [mainnet, anvil] : [mainnet];

type ChainId = (typeof supportedChains)[number]["id"];
type TransportsMap = Record<ChainId, Transport>;

/** Bound every RPC transport so a stalled endpoint cannot hold a request open. */
const RPC_TRANSPORT_TIMEOUT_MS = 2_000;

/**
 * Returns the base URLs that should back a chain transport: the primary alone in
 * local-node mode (Anvil does not serve chain paths), otherwise the primary followed
 * by the configured public fallbacks with duplicates removed.
 */
export function getRpcTransportUrls(
  chain: Chain,
  {
    fallbackUrls = RPC_FALLBACK_URLS,
    localNode = isLocalNode,
    rpcUrl = RPC_URL,
  }: {
    fallbackUrls?: readonly string[];
    localNode?: boolean;
    rpcUrl?: string;
  } = {}
): string[] {
  const rpcUrls = localNode ? [rpcUrl] : [rpcUrl, ...fallbackUrls];
  return [...new Set(rpcUrls.map((currentRpcUrl) => getChainRpcUrl(currentRpcUrl, chain.id, localNode)))];
}

function createRpcTransport(chain: Chain): Transport {
  const selectedRpcUrl = getResolvedRpcBaseUrl() || RPC_URL;
  const rpcTransports = getRpcTransportUrls(chain, { rpcUrl: selectedRpcUrl }).map((rpcUrl) =>
    http(rpcUrl, {
      batch: !isLocalNode,
      timeout: RPC_TRANSPORT_TIMEOUT_MS,
    })
  );

  if (rpcTransports.length === 1) return rpcTransports[0];
  return fallback(rpcTransports, { rank: false });
}

// Anvil doesn't support URLs like http://localhost:8545/31337
const transports = supportedChains.reduce<TransportsMap>((acc, chain) => {
  acc[chain.id] = createRpcTransport(chain);
  return acc;
}, {} as TransportsMap);

export const wagmiConfig = createConfig({
  chains: supportedChains,
  transports,
  connectors: [injected()],
  batch: {
    multicall: false, // Disabled because rpc.ubq.fi already uses multicall
  },
});
