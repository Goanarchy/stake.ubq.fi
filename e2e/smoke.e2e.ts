import { expect, test, type Page } from "@playwright/test";

/** Keeps the smoke suite offline: JSON-RPC providers plus the WalletConnect/Reown hosts a wallet connector could reach. */
const BLOCKED_ROUTES = [
  // Origin-relative production proxy (used when VITE_RPC_URL is unset) and the configured public fallback.
  "**/rpc/**",
  "https://rpc.ubq.fi/**",
  // WalletConnect/Reown relay, verify, explorer, pulse and dashboard endpoints.
  "**/*walletconnect.com/**",
  "**/*walletconnect.org/**",
  "**/*web3modal.com/**",
  "**/*web3modal.org/**",
  "**/*reown.com/**",
];

async function blockNoisyNetworkCalls(page: Page) {
  await Promise.all(BLOCKED_ROUTES.map((url) => page.route(url, (route) => route.abort())));
}

test.beforeAll(async ({ request }, testInfo) => {
  // Skip gracefully when nothing serves the configured base URL (missing preview build or occupied port).
  const health = await request.get("/").catch(() => null);
  if (!health?.ok()) {
    const baseURL = testInfo.project.use.baseURL ?? "the configured base URL";
    test.skip(true, `Preview server is not available at ${baseURL}. Port may be in use.`);
  }
});

test("loads-homepage", async ({ page }) => {
  await blockNoisyNetworkCalls(page);
  await page.goto("/");

  // Folded legacy "renders landing page" assertion, kept so no existing coverage is dropped.
  await expect(page.locator("body")).toBeVisible();
  await expect(page).toHaveTitle(/stake|staking/i);
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /ubiquity\s+staking/i })).toBeVisible();
});

test("connect-wallet-visible", async ({ page }) => {
  await blockNoisyNetworkCalls(page);
  await page.goto("/");

  // Assert the connect trigger renders without clicking it, so no wallet or relay connection is attempted.
  await expect(page.getByRole("button", { name: /connect/i })).toBeVisible();
});
