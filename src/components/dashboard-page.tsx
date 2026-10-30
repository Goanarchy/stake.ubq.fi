import { lazy, Suspense } from "react";
import { useAccount, useChainId } from "wagmi";
import { ICONS } from "./iconography.tsx";
import { PoolDisplay } from "./pool-display.tsx";
import { supportedChains } from "../wallet/chains.ts";
import { useStatusMessageState } from "../context/status-message.tsx";

const ConnectWalletButton = lazy(() => import("./connect-wallet.tsx").then((m) => ({ default: m.ConnectWalletButton })));
const RpcDiagnostics = lazy(() => import("./rpc-diagnostics.tsx").then((m) => ({ default: m.RpcDiagnostics })));

const LogoSpan = () => <span id="header-logo-wrapper">{ICONS.DAO_LOGO}</span>;

export function DashboardPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { successMessage, errorMessage } = useStatusMessageState();

  const isUnsupportedChain = isConnected && chainId && !supportedChains.some((c) => c.id === chainId);

  return (
    <>
      {/* Header Section */}
      <section id="header" className="header-logged-in">
        <div id="logo-wrapper">
          <h1>
            <LogoSpan />
            <span>Ubiquity</span>
            <span>Staking</span>
          </h1>
        </div>

        <Suspense
          fallback={
            <button className="primary-btn" disabled>
              Connect Wallet
            </button>
          }
        >
          <ConnectWalletButton />
        </Suspense>
      </section>

      {/* Status Displays */}
      {errorMessage && (
        <section id="error-message-wrapper">
          <div className="status-message">
            {ICONS.WARNING}
            <span>{errorMessage}</span>
          </div>
        </section>
      )}
      {successMessage && (
        <section id="success-message-wrapper">
          <div className="status-message">
            {ICONS.SUCCESS}
            <span>{successMessage}</span>
          </div>
        </section>
      )}

      <Suspense fallback={null}>
        <RpcDiagnostics />
      </Suspense>

      {isUnsupportedChain ? (
        <div className="pool-container">
          <div style={{ padding: "20px" }}>Switch to one of the supported chains: {supportedChains.map((chain) => chain.name).join(", ")}</div>
        </div>
      ) : (
        <PoolDisplay />
      )}
    </>
  );
}
