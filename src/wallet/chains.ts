import { mainnet, anvil, type Chain } from "viem/chains";
import { isLocalNode } from "../constants/config";

export const supportedChains: readonly [Chain, ...Chain[]] = isLocalNode ? [mainnet, anvil] : [mainnet];
export type ChainId = (typeof supportedChains)[number]["id"];
