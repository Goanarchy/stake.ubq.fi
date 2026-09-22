import { useSyncExternalStore } from "react";
import { getRpcRuntimeState, subscribeRpcRuntime } from "../utils/rpc-runtime";

/**
 * Dev-only diagnostics card for the RPC runtime selection.
 * `vite build --mode prod` inlines MODE as "prod", so the panel renders nothing in production.
 */
export function RpcDiagnostics() {
  const state = useSyncExternalStore(subscribeRpcRuntime, getRpcRuntimeState, getRpcRuntimeState);

  if (import.meta.env.MODE === "prod") return null;

  return (
    <section
      id="rpc-diagnostics"
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 9999,
        maxWidth: 320,
        padding: "12px 16px",
        border: "1px solid #2f2f2f",
        borderRadius: 8,
        background: "#1a1a2e",
        color: "#eee",
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 6 }}>RPC diagnostics</div>
      <div>Mode: {import.meta.env.MODE}</div>
      <div>RPC: {state.resolvedRpcUrl}</div>
      <div>Status: {state.lastStatus}</div>
      <div>Chain ID: {state.lastChainId ?? "n/a"}</div>
      <div>Recent errors: {state.recentErrorCount}</div>
    </section>
  );
}
