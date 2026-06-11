import test from "node:test";
import assert from "node:assert/strict";
import { PROJECTS, getProjectProfile } from "../src/config/projects.js";
import { buildReport } from "../src/lib/build-report.js";
import { resolveProject } from "../src/lib/project-resolution.js";

const unavailableDiscovery = {
  searchCoinGeckoProjects: async () => { throw new Error("discovery unavailable"); },
};

async function withUnavailableSources(run) {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    throw new Error("source unavailable");
  };
  try {
    return await run(requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("runtime fallback project builds a compatible partial report without curated-only identifiers", async () => {
  const project = await resolveProject("example-token", unavailableDiscovery);

  await withUnavailableSources(async (requests) => {
    const report = await buildReport(project);

    assert.equal(report.meta.slug, project.slug);
    assert.equal(report.meta.project_resolution.mode, "runtime");
    assert.deepEqual(report.meta.project_profile, getProjectProfile(project));
    assert.ok(report.meta.section_selection.enabledSections.includes("market"));
    assert.equal(report.meta.section_selection.sections.tvl_and_capital.status, "disabled_by_profile");
    assert.equal(report.meta.section_selection.sections.financials.status, "disabled_by_profile");
    assert.equal(report.meta.section_selection.sections.users_and_activity.status, "disabled_by_profile");
    assert.ok(!report.meta.section_selection.enabledSections.includes("tvl_and_capital"));
    assert.ok(!report.meta.section_selection.enabledSections.includes("financials"));
    assert.ok(!report.meta.section_selection.enabledSections.includes("users_and_activity"));
    assert.equal(report.market.price.status, "unavailable");
    assert.deepEqual(report.charts.price_history, []);
    assert.ok(!requests.some((url) => url.includes("api.coingecko.com")), "CoinGecko must not be called without a resolved id");
    assert.ok(!requests.some((url) => url.includes("undefined")), "missing curated identifiers must not produce malformed source requests");
  });
});

test("buildReport keeps curated ETH and SOL profiles and selected sections compatible", async () => {
  await withUnavailableSources(async () => {
    for (const project of [PROJECTS.eth, PROJECTS.sol]) {
      const report = await buildReport(project);

      assert.equal(report.meta.slug, project.slug);
      assert.deepEqual(report.meta.project_profile, getProjectProfile(project));
      assert.ok(report.meta.section_selection.enabledSections.includes("market"));
      assert.ok(report.meta.section_selection.enabledSections.includes("tvl_and_capital"));
      assert.ok(report.meta.section_selection.enabledSections.includes("financials"));
    }
  });
});
