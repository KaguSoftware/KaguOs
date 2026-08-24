/**
 * Screenshot harness — drives the real app in a real browser.
 *
 * Uses playwright-core against the Chrome already installed on the machine
 * (`channel: "chrome"`), so there is no browser download and nothing to keep in
 * sync. It is a dev tool, not a test suite: it logs in as each principal, walks
 * the surfaces, and writes PNGs to .shots/ for eyeballing.
 *
 * ⚠️ READ-ONLY BY DESIGN. `.env.local` points at the HOSTED Supabase project,
 * so this is driving production data — a real client's real answers. It clicks
 * navigation and toggles (which write only a cookie) and never types into a
 * field, never presses Send, never adds or removes a table line.
 *
 *   node scripts/shots.mjs [baseUrl]
 *
 * Credentials come from the environment so they stay out of the repo:
 *   KAGU_ADMIN_EMAIL / KAGU_ADMIN_PASSWORD
 *   KAGU_CLIENT_EMAIL / KAGU_CLIENT_PASSWORD
 */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3400";
const OUT = path.join(process.cwd(), ".shots");
const PROJECT_ID = "37024fb4-0852-4fe3-a9f8-3835f4ee4666";

const ADMIN = {
  email: process.env.KAGU_ADMIN_EMAIL,
  password: process.env.KAGU_ADMIN_PASSWORD,
};
const CLIENT = {
  email: process.env.KAGU_CLIENT_EMAIL,
  password: process.env.KAGU_CLIENT_PASSWORD,
};

/**
 * Wait for the page to actually be the page.
 *
 * A fixed timeout is not enough against a cold Turbopack dev server: the first
 * hit on a route compiles it, and an early capture photographs the "Compiling"
 * badge over a half-rendered login form. So: network idle, then the dev
 * overlay's compile indicator gone, then a beat for fonts.
 */
async function settle(page, ms = 700) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .waitForFunction(
      () =>
        !document.body.innerText.includes("Compiling") &&
        !document.body.innerText.includes("Rendering"),
      undefined,
      { timeout: 90_000 }
    )
    .catch(() => {});
  await page.waitForTimeout(ms);
}

/** Wait for a specific thing to exist before believing the navigation landed. */
async function waitFor(page, locator, timeout = 90_000) {
  await locator.first().waitFor({ state: "visible", timeout });
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ▸ ${name}.png`);
}

async function signIn(page, who) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await settle(page, 400);
  await page.fill('input[type="email"]', who.email);
  await page.fill('input[type="password"]', who.password);
  await page.click('button[type="submit"]');
  // The sign-in leaves /login. Waiting on the URL rather than a timeout is what
  // makes this reliable on a cold server.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 90_000,
  });
  await settle(page, 1200);
}

/** Flip a Segmented control by its visible label. */
async function segment(page, groupLabel, optionText) {
  const group = page.getByRole("group", { name: groupLabel });
  await group.getByRole("button", { name: optionText, exact: true }).click();
  await settle(page, 800);
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  try {
    /* ── the client ─────────────────────────────────────────────────────── */
    if (CLIENT.email) {
      console.log("client:");
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await ctx.newPage();
      await signIn(page, CLIENT);
      // The wizard rail is the proof the pack rendered, not the login form.
      await waitFor(page, page.getByRole("navigation", { name: "Pack sections" }));
      await settle(page);
      await shot(page, "client-01-pack-en");

      // Step through a couple of sections so the wizard's later steps are seen.
      for (const n of [2, 3]) {
        await page.getByRole("button", { name: /^Next$/ }).click();
        await settle(page, 700);
        await shot(page, `client-0${n}-step${n}-en`);
      }

      // The review step, via the rail.
      await page
        .getByRole("button", { name: "Review and send" })
        .last()
        .click();
      await settle(page, 700);
      await shot(page, "client-04-review-en");

      // Arabic — the whole page should turn around.
      await segment(page, "Language", "ع");
      await shot(page, "client-05-review-ar");
      await page.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
      await waitFor(page, page.getByRole("navigation", { name: "أقسام الحزمة" }));
      await settle(page);
      await shot(page, "client-06-pack-ar");

      // Narrow, where the rail collapses.
      await page.setViewportSize({ width: 420, height: 900 });
      await settle(page, 600);
      await shot(page, "client-07-mobile-ar");
      await segment(page, "اللغة", "EN");
      await shot(page, "client-08-mobile-en");

      await ctx.close();
    }

    /* ── the client, on a phone ─────────────────────────────────────────── */
    // The device that matters most: a business owner fills this in on a phone,
    // not at a desk. Two widths — a common modern handset and a small one — in
    // both languages, across the steps that stress the layout hardest (chips,
    // a repeating table, the review list).
    if (CLIENT.email && process.env.KAGU_SHOTS_MOBILE !== "0") {
      console.log("client (phone):");
      for (const [tag, width, height] of [
        ["390", 390, 844],
        ["320", 320, 700],
      ]) {
        const ctx = await browser.newContext({
          viewport: { width, height },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        });
        const page = await ctx.newPage();
        await signIn(page, CLIENT);
        await waitFor(page, page.getByRole("navigation", { name: "Pack sections" }));
        await settle(page);
        await shot(page, `phone-${tag}-01-step1-en`);

        // Section 03 is the worst case: a repeating table of courts plus the
        // seven-day hours grid.
        for (let i = 0; i < 2; i++) {
          await page.getByRole("button", { name: /^Next$/ }).click();
          await settle(page, 700);
        }
        await shot(page, `phone-${tag}-02-step3-en`);

        // On a phone the rail lives inside a collapsed <details>, so the
        // review button is not clickable until the disclosure is open. That is
        // the real navigation a phone user performs, so drive it the same way.
        await page.locator("summary").first().click();
        await settle(page, 400);
        await page.getByRole("button", { name: "Review and send" }).last().click();
        await settle(page, 700);
        await shot(page, `phone-${tag}-03-review-en`);

        await segment(page, "Language", "ع");
        await shot(page, `phone-${tag}-04-review-ar`);

        // Open the collapsed rail — on a phone it is the only navigation.
        await page.locator("summary").first().click();
        await settle(page, 500);
        await shot(page, `phone-${tag}-05-rail-ar`);

        await ctx.close();
      }
    }

    /* ── the team ───────────────────────────────────────────────────────── */
    if (ADMIN.email) {
      console.log("admin:");
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
      const page = await ctx.newPage();
      await signIn(page, ADMIN);
      await page.goto(`${BASE}/work/projects/${PROJECT_ID}/intake`, {
        waitUntil: "domcontentloaded",
      });
      await waitFor(page, page.getByRole("group", { name: "Which answers to show" }));
      await settle(page);
      await shot(page, "admin-01-intake-all-en");

      await segment(page, "Which answers to show", "Answered");
      await shot(page, "admin-02-intake-answered");

      await segment(page, "Which answers to show", "Gaps");
      await shot(page, "admin-03-intake-gaps");

      await segment(page, "Which answers to show", "All");
      await segment(page, "Pack language", "EN+ع");
      await shot(page, "admin-04-intake-both");

      await segment(page, "Pack language", "ع");
      await shot(page, "admin-05-intake-ar");

      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\nwrote to ${OUT}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
