/**
 * RPC endpoint resolution for blockchain calls.
 * - local-node mode is pinned to the raw Anvil URL (http://localhost:8545) and never appends a chain suffix.
 * - Development and Deno Deploy preview links default to https://rpc.ubq.fi.
 * - Production defaults to the origin-relative /rpc proxy, matching the historical behavior.
 */

export const MAINNET_RPC_FALLBACK_URL = "https://rpc.ubq.fi";
export const DEFAULT_MAINNET_RPC_FALLBACKS = [MAINNET_RPC_FALLBACK_URL] as const;
export const LOCAL_NODE_RPC_URL = "http://localhost:8545";
export const LOCAL_NODE_CHAIN_ID = 31337;
export const PRODUCTION_RPC_PATH = "/rpc";

export const isLocalNode = import.meta.env.MODE === "local-node";
export const isDenoDeployHost = (hostname: string) => hostname.endsWith(".deno.dev") || hostname.endsWith(".deno.net");

export type RpcUrlValidation = {
  valid: boolean;
  reason?: string;
};

const stripTrailingSlashes = (value: string): string => (value === "/" ? value : value.replace(/\/+$/, ""));

const splitUrlSuffix = (value: string): [string, string] => {
  const indexes = [value.indexOf("?"), value.indexOf("#")].filter((index) => index >= 0);
  if (indexes.length === 0) return [value, ""];
  const suffixIndex = Math.min(...indexes);
  return [value.slice(0, suffixIndex), value.slice(suffixIndex)];
};

/**
 * Validates a configured RPC base URL and reports a typed reason when it is rejected.
 * Protocol-relative URLs ("//host") are rejected because they silently switch origins.
 */
export function validateRpcUrl(value: string): RpcUrlValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, reason: "RPC URL is empty" };
  }

  if (trimmed.startsWith("//")) {
    return { valid: false, reason: "Protocol-relative RPC URLs are not supported" };
  }

  if (trimmed.startsWith("/")) {
    return { valid: true };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, reason: `RPC URL must use http or https, received "${parsed.protocol}"` };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "RPC URL must be an absolute http(s) URL or a relative path" };
  }
}

export const isValidRpcUrl = (value: string): boolean => validateRpcUrl(value).valid;

/** Removes trailing slashes from the base part while preserving any query string or hash. */
export const normalizeRpcBaseUrl = (value: string): string => {
  const [base, suffix] = splitUrlSuffix(value.trim());
  return `${stripTrailingSlashes(base)}${suffix}`;
};

/**
 * Builds a chain-aware RPC URL. The chain path is inserted before any query string
 * ("https://rpc.example/rpc?key=abc" -> "https://rpc.example/rpc/1?key=abc") and is skipped
 * entirely in local-node mode because Anvil does not serve chain paths.
 */
export function getChainRpcUrl(rpcUrl: string, chainId: number, localNode = isLocalNode): string {
  const [base, suffix] = splitUrlSuffix(normalizeRpcBaseUrl(rpcUrl));
  return localNode ? `${base}${suffix}` : `${base}/${chainId}${suffix}`;
}

export const getDefaultRpcUrl = (mode: string, origin: string, hostname: string): string => {
  if (mode === "local-node") return LOCAL_NODE_RPC_URL;
  if (mode === "dev" || isDenoDeployHost(hostname)) return MAINNET_RPC_FALLBACK_URL;
  return origin ? `${origin}${PRODUCTION_RPC_PATH}` : PRODUCTION_RPC_PATH;
};

/** Public mainnet fallback bases, dropped when the primary already is the public endpoint. */
export function getRpcFallbackUrls(primaryRpcUrl: string, mode: string): string[] {
  if (mode === "local-node") return [];
  const normalizedPrimary = normalizeRpcBaseUrl(primaryRpcUrl);
  return normalizedPrimary === MAINNET_RPC_FALLBACK_URL ? [] : [...DEFAULT_MAINNET_RPC_FALLBACKS];
}

export type RpcResolutionSource = "env" | "default";

export type ResolveRpcConfigParams = {
  mode: string;
  hostname: string;
  origin: string;
  envRpcUrl?: string;
  warn?: (message: string) => void;
};

export type RpcConfigResolution = {
  rpcUrl: string;
  fallbackRpcUrls: string[];
  warnings: string[];
  source: RpcResolutionSource;
};

/** Resolves the mode-aware RPC base URL, validating VITE_RPC_URL and reporting every rejection. */
export function resolveRpcConfig(params: ResolveRpcConfigParams): RpcConfigResolution {
  const { mode, hostname, origin, envRpcUrl } = params;
  const warnings: string[] = [];
  const emitWarning = (message: string) => {
    warnings.push(message);
    params.warn?.(message);
  };

  if (mode === "local-node") {
    if (envRpcUrl && normalizeRpcBaseUrl(envRpcUrl) !== LOCAL_NODE_RPC_URL) {
      emitWarning(`[rpc-config] Ignoring VITE_RPC_URL "${envRpcUrl}" because local-node mode is pinned to "${LOCAL_NODE_RPC_URL}".`);
    }
    return { rpcUrl: LOCAL_NODE_RPC_URL, fallbackRpcUrls: [], warnings, source: "default" };
  }

  if (envRpcUrl) {
    const validation = validateRpcUrl(envRpcUrl);
    if (validation.valid) {
      const rpcUrl = normalizeRpcBaseUrl(envRpcUrl);
      return { rpcUrl, fallbackRpcUrls: getRpcFallbackUrls(rpcUrl, mode), warnings, source: "env" };
    }

    const defaultRpcUrl = getDefaultRpcUrl(mode, origin, hostname);
    emitWarning(
      `[rpc-config] Ignoring invalid VITE_RPC_URL "${envRpcUrl}": ${validation.reason ?? "unknown validation error"}. Falling back to "${defaultRpcUrl}".`
    );
    const fallbackUrl = normalizeRpcBaseUrl(defaultRpcUrl);
    return { rpcUrl: fallbackUrl, fallbackRpcUrls: getRpcFallbackUrls(fallbackUrl, mode), warnings, source: "default" };
  }

  const rpcUrl = normalizeRpcBaseUrl(getDefaultRpcUrl(mode, origin, hostname));
  return { rpcUrl, fallbackRpcUrls: getRpcFallbackUrls(rpcUrl, mode), warnings, source: "default" };
}

export type RpcBaseUrlResolution = {
  rpcBaseUrl: string;
  fallbacks: string[];
  source: RpcResolutionSource;
  warnings: string[];
};

/** #14-shaped view over {@link resolveRpcConfig} exposing the base URL, its fallbacks and the resolution source. */
export function resolveRpcBaseUrl(params: ResolveRpcConfigParams): RpcBaseUrlResolution {
  const { rpcUrl, fallbackRpcUrls, source, warnings } = resolveRpcConfig(params);
  return { rpcBaseUrl: rpcUrl, fallbacks: fallbackRpcUrls, source, warnings };
}

const currentLocation = globalThis.location;
const resolved = resolveRpcConfig({
  mode: import.meta.env.MODE ?? "prod",
  hostname: currentLocation?.hostname ?? "",
  origin: currentLocation?.origin ?? "",
  envRpcUrl: import.meta.env.VITE_RPC_URL,
  warn: (message) => console.warn(message),
});

export const RPC_URL = resolved.rpcUrl;
export const RPC_FALLBACK_URLS = resolved.fallbackRpcUrls;
