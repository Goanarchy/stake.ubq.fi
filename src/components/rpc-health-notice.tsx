import { useEffect, useRef } from "react";
import { getChainRpcUrl, isLocalNode, LOCAL_NODE_CHAIN_ID, LOCAL_NODE_RPC_URL } from "../constants/config";
import { useStatusMessageDispatch, useStatusMessageState } from "../context/status-message.tsx";
import { DEFAULT_RPC_HEALTH_TIMEOUT_MS, rpcHealthCheck } from "../utils/rpc-health";
import { getResolvedRpcBaseUrl } from "../utils/rpc-runtime";

export const LOCAL_NODE_UNAVAILABLE_MESSAGE = `Local node RPC unavailable at ${LOCAL_NODE_RPC_URL}. Start Anvil and refresh.`;

const LOCAL_NODE_POLL_INTERVAL_MS = 15_000;

/**
 * In local-node mode, polls the pinned Anvil endpoint and surfaces an "unavailable" notice
 * through StatusMessageProvider, clearing it again once the node responds.
 */
export function RpcHealthNotice() {
  const dispatch = useStatusMessageDispatch();
  const { errorMessage } = useStatusMessageState();
  const currentErrorRef = useRef(errorMessage);

  useEffect(() => {
    currentErrorRef.current = errorMessage;
  }, [errorMessage]);

  useEffect(() => {
    if (!isLocalNode) return;

    let cancelled = false;
    const healthUrl = getChainRpcUrl(getResolvedRpcBaseUrl(), LOCAL_NODE_CHAIN_ID, true);

    const check = async () => {
      const result = await rpcHealthCheck(healthUrl, {
        expectedChainId: LOCAL_NODE_CHAIN_ID,
        timeoutMs: DEFAULT_RPC_HEALTH_TIMEOUT_MS,
      });
      if (cancelled) return;

      if (result.status === "healthy") {
        if (currentErrorRef.current === LOCAL_NODE_UNAVAILABLE_MESSAGE) {
          dispatch({ type: "clear" });
        }
        return;
      }

      // Never overwrite a different error that is already on screen.
      if (!currentErrorRef.current || currentErrorRef.current === LOCAL_NODE_UNAVAILABLE_MESSAGE) {
        dispatch({ type: "setError", message: LOCAL_NODE_UNAVAILABLE_MESSAGE });
      }
    };

    void check();
    const id = setInterval(() => void check(), LOCAL_NODE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [dispatch]);

  return null;
}
