import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import * as wagmi from "wagmi";

const LP_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";
const REWARD_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000002";
const USER_ADDRESS = "0x0000000000000000000000000000000000000003";

type TokenInfo = {
  address: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
};

const tokenInfoByAddress: Record<string, TokenInfo> = {
  [LP_TOKEN_ADDRESS]: { address: LP_TOKEN_ADDRESS, name: "Liquidity Token", symbol: "LPT", decimals: 18 },
  [REWARD_TOKEN_ADDRESS]: { address: REWARD_TOKEN_ADDRESS, name: "Reward Token", symbol: "UBQ", decimals: 18 },
};

function queryState<T>(data: T) {
  return {
    data,
    error: null,
    fetchStatus: "idle",
    isLoading: false,
    refetch: mock(),
  };
}

const loadPoolDisplay = () => import("../pool-display");

// Spread the real module so this mock cannot break other suites that import wagmi (for example src/wallet/config).
mock.module("wagmi", () => ({
  ...wagmi,
  useAccount: () => ({ address: USER_ADDRESS, isConnected: true }),
  useReadContract: ({ functionName }: { functionName: string }) => {
    if (functionName === "getStakingSettings") {
      return queryState([REWARD_TOKEN_ADDRESS, 0n, 0n, 1000000000000000000n, 0n, 0n, 100n, 0n]);
    }

    if (functionName === "getStakingPoolInfo") {
      return queryState({
        lpToken: LP_TOKEN_ADDRESS,
        amount: 200000000000000000000n,
        allocationPoints: 25n,
      });
    }

    return queryState(undefined);
  },
}));

// Fail closed: only the two known token addresses resolve; anything else returns no token data.
mock.module("../../hooks/erc20Token", () => ({
  useErc20Token: (address: string | undefined) => queryState(address ? tokenInfoByAddress[address.toLowerCase()] : undefined),
}));

mock.module("../../hooks/useStaking", () => ({
  useStaking: () => ({
    data: {
      userInfo: queryState({ amount: 50000000000000000000n }),
      pendingRewards: queryState(2500000000000000000n),
      allowance: queryState(0n),
      balance: queryState(100000000000000000000n),
    },
    actions: {
      executeApprove: mock(),
      executeStake: mock(),
      executeUnstake: mock(),
      executeClaim: mock(),
    },
    refetchAll: mock(),
  }),
}));

describe("getPoolDisplayMetrics", () => {
  it("maps pool totals and user stake into displayable reward values", async () => {
    const { getPoolDisplayMetrics } = await loadPoolDisplay();

    const metrics = getPoolDisplayMetrics({
      rewardPerBlock: 10n * 10n ** 18n,
      poolAllocationPoints: 25n,
      totalAllocationPoints: 100n,
      rewardTokenDecimals: 18,
      poolAmount: 1_000n * 10n ** 18n,
      userAmount: 100n * 10n ** 18n,
      lpTokenDecimals: 18,
    });

    expect(metrics.poolRewardPerDay).toBe(17_917.5);
    expect(metrics.userPoolShare).toBe(0.1);
    expect(metrics.userRewardPerDay).toBe(1_791.75);
  });

  it("does not derive a user reward when the pool has no stake", async () => {
    const { getPoolDisplayMetrics } = await loadPoolDisplay();

    const metrics = getPoolDisplayMetrics({
      rewardPerBlock: 10n * 10n ** 18n,
      poolAllocationPoints: 25n,
      totalAllocationPoints: 100n,
      rewardTokenDecimals: 18,
      poolAmount: 0n,
      userAmount: 100n * 10n ** 18n,
      lpTokenDecimals: 18,
    });

    expect(metrics.userPoolShare).toBeNull();
    expect(metrics.userRewardPerDay).toBeNull();
  });
});

describe("PoolDisplay", () => {
  it("maps pool, wallet, and reward data into the rendered summary", async () => {
    const { PoolDisplay } = await loadPoolDisplay();

    render(<PoolDisplay poolId={1n} />);

    expect(screen.getByText("Liquidity Token Pool")).toBeTruthy();
    expect(screen.getByText("Total Staked: 200 LPT")).toBeTruthy();
    expect(screen.getByText(/Your Stake: 50 LPT/)).toBeTruthy();
    expect(screen.getByText(/25\.00% of pool/)).toBeTruthy();
    expect(screen.getByText(/Pending Rewards:/).textContent).toContain("2.50 UBQ");
    expect(screen.getByText("Reward Per Day: 447.94 UBQ")).toBeTruthy();
  });
});
