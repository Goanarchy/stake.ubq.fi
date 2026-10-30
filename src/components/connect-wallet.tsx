import { useEffect } from "react";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { supportedChains } from "../wallet/chains";
import { ICONS } from "./iconography";
import { formatWalletAddress, getChainName } from "../utils";
import { useStatusMessageDispatch } from "../context/status-message";
import { Button } from "./button";

export function ConnectWalletButton() {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, status: connectStatus } = useConnect();
  const dispatchStatusMessage = useStatusMessageDispatch();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    dispatchStatusMessage({ type: "clear" });
  }, [isConnected, chainId, dispatchStatusMessage]);

  const disconnectWallet = async () => {
    try {
      disconnect();
      dispatchStatusMessage({ type: "clear" });
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  const connectWallet = () => {
    const connector = connectors.find((item) => item.id === "injected") ?? connectors[0];

    if (!connector) {
      dispatchStatusMessage({ type: "setError", message: "No injected wallet detected" });
      return;
    }

    dispatchStatusMessage({ type: "clear" });
    connect(
      { connector },
      {
        onError: (error) => {
          dispatchStatusMessage({ type: "setError", message: error.message });
        },
      }
    );
  };

  const isConnecting = status === "connecting" || connectStatus === "pending";

  if (isConnected && address) {
    return (
      <div className="wallet-connect-container">
        <Button onClick={disconnectWallet} className="wallet-button wallet-button--connected" id="disconnect" title="Click to disconnect wallet">
          {ICONS.DISCONNECT}
          <span>
            {formatWalletAddress(address)} (
            {getChainName(
              chainId,
              supportedChains.map((c) => ({ id: c.id, name: c.name }))
            )}
            )
          </span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={connectWallet}
      className="wallet-button"
      disabled={isConnecting}
      isLoading={isConnecting}
      isLoadingText="Connecting..."
      title={isConnecting ? "Connecting to wallet..." : "Connect your wallet"}
    >
      {ICONS.CONNECT}
      <span>Connect Wallet</span>
    </Button>
  );
}
