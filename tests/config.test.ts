import { describe, expect, it } from "bun:test";

import {
  DEFAULT_MAINNET_RPC_FALLBACKS,
  getChainRpcUrl,
  getDefaultRpcUrl,
  getRpcFallbackUrls,
  isDenoDeployHost,
  isValidRpcUrl,
  LOCAL_NODE_RPC_URL,
  MAINNET_RPC_FALLBACK_URL,
  resolveRpcBaseUrl,
  resolveRpcConfig,
  validateRpcUrl,
} from "../src/constants/config";

describe("isDenoDeployHost", () => {
  it("matches Deno Deploy preview hostnames", () => {
    expect(isDenoDeployHost("stake-ubq-fi.deno.dev")).toBe(true);
    expect(isDenoDeployHost("p-stake-ubq-fi.ubiquity-dao.deno.net")).toBe(true);
  });

  it("does not match unrelated hostnames", () => {
    expect(isDenoDeployHost("stake.ubq.fi")).toBe(false);
    expect(isDenoDeployHost("localhost")).toBe(false);
  });
});

describe("validateRpcUrl", () => {
  it("accepts absolute http(s) URLs and relative paths", () => {
    expect(validateRpcUrl("https://rpc.ubq.fi").valid).toBe(true);
    expect(validateRpcUrl("http://localhost:8545").valid).toBe(true);
    expect(validateRpcUrl("/rpc").valid).toBe(true);
  });

  it("rejects protocol-relative URLs", () => {
    const result = validateRpcUrl("//rpc.ubq.fi");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Protocol-relative");
  });

  it("reports typed reasons for unsupported and malformed values", () => {
    expect(validateRpcUrl("ftp://rpc.ubq.fi").reason).toContain("http");
    expect(validateRpcUrl("not a url").reason).toContain("absolute");
    expect(validateRpcUrl("   ").reason).toContain("empty");
  });

  it("mirrors validation through isValidRpcUrl", () => {
    expect(isValidRpcUrl("https://rpc.ubq.fi")).toBe(true);
    expect(isValidRpcUrl("/rpc")).toBe(true);
    expect(isValidRpcUrl("//rpc.ubq.fi")).toBe(false);
    expect(isValidRpcUrl("")).toBe(false);
  });
});

describe("getDefaultRpcUrl", () => {
  it("pins local-node mode to the raw Anvil endpoint", () => {
    expect(getDefaultRpcUrl("local-node", "http://localhost:5173", "localhost")).toBe(LOCAL_NODE_RPC_URL);
  });

  it("uses the public endpoint for dev and Deno Deploy previews", () => {
    expect(getDefaultRpcUrl("dev", "http://localhost:5173", "localhost")).toBe(MAINNET_RPC_FALLBACK_URL);
    expect(getDefaultRpcUrl("prod", "https://preview.deno.dev", "preview.deno.dev")).toBe(MAINNET_RPC_FALLBACK_URL);
  });

  it("keeps the production origin-relative /rpc behavior", () => {
    expect(getDefaultRpcUrl("prod", "https://stake.ubq.fi", "stake.ubq.fi")).toBe("https://stake.ubq.fi/rpc");
    expect(getDefaultRpcUrl("prod", "", "stake.ubq.fi")).toBe("/rpc");
  });
});

describe("getRpcFallbackUrls", () => {
  it("adds the public fallback only when the primary differs", () => {
    expect(getRpcFallbackUrls("https://example.com/rpc", "dev")).toEqual([MAINNET_RPC_FALLBACK_URL]);
    expect(getRpcFallbackUrls("https://rpc.ubq.fi/", "dev")).toEqual([]);
    expect(getRpcFallbackUrls("http://localhost:8545", "local-node")).toEqual([]);
  });
});

describe("resolveRpcConfig", () => {
  it("pins local-node mode to the raw Anvil endpoint with no fallbacks", () => {
    const warnings: string[] = [];
    const resolved = resolveRpcConfig({
      mode: "local-node",
      hostname: "localhost",
      origin: "http://localhost:5173",
      envRpcUrl: MAINNET_RPC_FALLBACK_URL,
      warn: (message) => warnings.push(message),
    });

    expect(resolved.rpcUrl).toBe(LOCAL_NODE_RPC_URL);
    expect(resolved.fallbackRpcUrls).toEqual([]);
    expect(resolved.source).toBe("default");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("pinned to");
  });

  it("uses a valid env URL and drops the public fallback when it matches", () => {
    const resolved = resolveRpcConfig({
      mode: "dev",
      hostname: "localhost",
      origin: "http://localhost:5173",
      envRpcUrl: "https://example.com/rpc/",
    });

    expect(resolved.rpcUrl).toBe("https://example.com/rpc");
    expect(resolved.fallbackRpcUrls).toEqual([MAINNET_RPC_FALLBACK_URL]);
    expect(resolved.source).toBe("env");
    expect(resolved.warnings).toEqual([]);

    const publicResolved = resolveRpcConfig({
      mode: "dev",
      hostname: "localhost",
      origin: "http://localhost:5173",
      envRpcUrl: MAINNET_RPC_FALLBACK_URL,
    });
    expect(publicResolved.rpcUrl).toBe(MAINNET_RPC_FALLBACK_URL);
    expect(publicResolved.fallbackRpcUrls).toEqual([]);
  });

  it("warns and falls back when VITE_RPC_URL is invalid", () => {
    const warnings: string[] = [];
    const resolved = resolveRpcConfig({
      mode: "dev",
      hostname: "localhost",
      origin: "http://localhost:5173",
      envRpcUrl: "this-is-not-a-url",
      warn: (message) => warnings.push(message),
    });

    expect(resolved.rpcUrl).toBe(MAINNET_RPC_FALLBACK_URL);
    expect(resolved.source).toBe("default");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("invalid VITE_RPC_URL");
  });

  it("warns and keeps the production /rpc fallback when the env URL is protocol-relative", () => {
    const warnings: string[] = [];
    const resolved = resolveRpcConfig({
      mode: "prod",
      hostname: "stake.ubq.fi",
      origin: "https://stake.ubq.fi",
      envRpcUrl: "//evil.example/rpc",
      warn: (message) => warnings.push(message),
    });

    expect(resolved.rpcUrl).toBe("https://stake.ubq.fi/rpc");
    expect(resolved.fallbackRpcUrls).toEqual([MAINNET_RPC_FALLBACK_URL]);
    expect(warnings[0]).toContain("Protocol-relative");
  });

  it("uses the production origin-relative /rpc default", () => {
    const resolved = resolveRpcConfig({ mode: "prod", hostname: "stake.ubq.fi", origin: "https://stake.ubq.fi" });

    expect(resolved.rpcUrl).toBe("https://stake.ubq.fi/rpc");
    expect(resolved.fallbackRpcUrls).toEqual([MAINNET_RPC_FALLBACK_URL]);
    expect(resolved.source).toBe("default");
    expect(resolved.warnings).toEqual([]);
    expect(DEFAULT_MAINNET_RPC_FALLBACKS).toContain(MAINNET_RPC_FALLBACK_URL);
  });
});

describe("resolveRpcBaseUrl", () => {
  it("exposes the base URL, fallbacks and resolution source", () => {
    const fromEnv = resolveRpcBaseUrl({
      mode: "dev",
      hostname: "localhost",
      origin: "http://localhost:5173",
      envRpcUrl: "https://example.com/rpc",
    });

    expect(fromEnv.rpcBaseUrl).toBe("https://example.com/rpc");
    expect(fromEnv.fallbacks).toEqual([MAINNET_RPC_FALLBACK_URL]);
    expect(fromEnv.source).toBe("env");
    expect(fromEnv.warnings).toEqual([]);

    const fromDefault = resolveRpcBaseUrl({ mode: "prod", hostname: "stake.ubq.fi", origin: "https://stake.ubq.fi" });
    expect(fromDefault.rpcBaseUrl).toBe("https://stake.ubq.fi/rpc");
    expect(fromDefault.fallbacks).toEqual([MAINNET_RPC_FALLBACK_URL]);
    expect(fromDefault.source).toBe("default");
  });
});

describe("getChainRpcUrl", () => {
  it("appends the chain id outside local-node mode", () => {
    expect(getChainRpcUrl("https://rpc.ubq.fi", 1, false)).toBe("https://rpc.ubq.fi/1");
    expect(getChainRpcUrl("https://rpc.ubq.fi/", 1, false)).toBe("https://rpc.ubq.fi/1");
  });

  it("keeps local-node URLs raw and unsuffixed", () => {
    expect(getChainRpcUrl("http://localhost:8545", 31337, true)).toBe("http://localhost:8545");
    expect(getChainRpcUrl("http://localhost:8545/", 31337, true)).toBe("http://localhost:8545");
  });

  it("keeps query strings after the chain path", () => {
    expect(getChainRpcUrl("https://rpc.example/rpc?key=abc", 1, false)).toBe("https://rpc.example/rpc/1?key=abc");
    expect(getChainRpcUrl("https://rpc.example/rpc/?key=abc", 1, false)).toBe("https://rpc.example/rpc/1?key=abc");
  });
});
