import test from "node:test";
import assert from "node:assert/strict";
import { PROJECTS } from "../src/config/projects.js";
import { buildRuntimeProjectSkeleton } from "../src/lib/project-resolution.js";
import { assessReportReadiness, orchestrateReportSources, publishReportReadiness } from "../src/lib/report-readiness.js";

function readyReport(project) {
  return {
    meta: {
      project_profile:project.projectProfile,
      market_symbols:project.marketSymbols,
      section_selection:{ sections:{ market:{ status:"enabled" } } },
    },
    market: {
      price:{ value:100 },
      market_cap:{ value:1_000_000_000 },
      volume_24h:{ value:50_000_000 },
    },
  };
}

test("source orchestration retries critical data and does not block on timed-out optional data", async () => {
  let attempts = 0;
  const { results, summary } = await orchestrateReportSources([
    { name:"market", critical:true, attempts:3, retryDelays:[1, 1], load:async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary market failure");
      return { current_price:1, market_cap:2, total_volume:3 };
    }, validate:(value) => Boolean(value?.total_volume) },
    { name:"news", load:() => new Promise(() => {}) },
  ], { critical:3_000, optional:10 });

  assert.equal(results.market.status, "fulfilled");
  assert.equal(results.market.attempts, 3);
  assert.equal(results.news.status, "rejected");
  assert.deepEqual(summary.failedCritical, []);
  assert.deepEqual(summary.failedOptional, ["news"]);
});

test("page-ready gate requires identity, profile, structure, symbols, and all hero market metrics", () => {
  for (const project of [PROJECTS.eth, PROJECTS.btc, PROJECTS.bnb, PROJECTS.sol, buildRuntimeProjectSkeleton("DOGE"), buildRuntimeProjectSkeleton("PEPE")]) {
    const report = readyReport(project);
    const readiness = publishReportReadiness(report, { ...project, resolution:project.resolution || { mode:"registered" } });
    assert.equal(readiness.state, "ready", `${project.ticker} should pass with its critical report model`);
    assert.deepEqual(readiness.missing, []);
  }

  const incomplete = readyReport(PROJECTS.bnb);
  incomplete.market.volume_24h.value = null;
  const blocked = assessReportReadiness(incomplete, { ...PROJECTS.bnb, resolution:{ mode:"registered" } });
  assert.equal(blocked.state, "blocked");
  assert.deepEqual(blocked.missing, ["volume_24h"]);
});

test("runtime report with base market data is partial but usable without optional structure", () => {
  const project = {
    resolution:{ mode:"runtime" },
    projectProfile:{},
    marketSymbols:{ technical:"ZENUSDT" },
  };
  const report = { meta:{}, market:{ price:{ value:10 }, fdv:{ value:1_000_000 }, volume_24h:{ value:50_000 } } };
  const readiness = assessReportReadiness(report, project);
  assert.equal(readiness.state, "partial");
  assert.equal(readiness.usable, true);
});

test("report is blocked when any base market requirement is unavailable", () => {
  const project = { resolution:{ mode:"runtime" }, projectProfile:{}, marketSymbols:{ technical:"ZENUSDT" } };
  const report = { meta:{}, market:{ price:{ value:10 }, market_cap:{ value:1_000_000 } } };
  const readiness = assessReportReadiness(report, project);
  assert.equal(readiness.state, "blocked");
  assert.equal(readiness.usable, false);
});


test("source orchestration does not retry hard 4xx failures", async () => {
  let attempts = 0;
  const hardError = Object.assign(new Error("market status: 404"), { status:404 });
  const { results } = await orchestrateReportSources([
    { name:"market", critical:true, attempts:3, retryDelays:[1, 1], load:async () => { attempts += 1; throw hardError; } },
  ]);
  assert.equal(results.market.status, "rejected");
  assert.equal(results.market.attempts, 1);
  assert.equal(attempts, 1);
});
