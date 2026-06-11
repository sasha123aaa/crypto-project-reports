import assert from "node:assert/strict";
import test from "node:test";
import { PROJECTS, getRegisteredProject, normalizeProjectInput } from "../src/config/projects.js";
import { buildRuntimeProjectSkeleton, resolveProject } from "../src/lib/project-resolution.js";

const noDiscoveryCalls = new Proxy({}, {
  get() { return () => { throw new Error("project resolution must not perform runtime discovery"); }; },
});

test("normalization produces stable lowercase slugs", () => {
  assert.equal(normalizeProjectInput("  ETH  "), "eth");
  assert.equal(normalizeProjectInput("Example Token"), "example-token");
  assert.equal(normalizeProjectInput("example_token"), "example-token");
  assert.equal(normalizeProjectInput(null), "");
});

test("registered lookup supports slug, ticker, name, CoinGecko id, and aliases", () => {
  for (const input of ["eth", "ETH", "Ethereum", "ether"]) {
    assert.equal(getRegisteredProject(input), PROJECTS.eth);
  }
  for (const input of ["sol", "SOL", "Solana"]) {
    assert.equal(getRegisteredProject(input), PROJECTS.sol);
  }
});

test("resolver gives curated projects priority without runtime discovery", async () => {
  for (const [input, expected] of [["eth", PROJECTS.eth], ["ETH", PROJECTS.eth], ["ethereum", PROJECTS.eth], ["sol", PROJECTS.sol], ["solana", PROJECTS.sol]]) {
    const project = await resolveProject(input, noDiscoveryCalls);
    assert.equal(project.slug, expected.slug);
    assert.equal(project.ticker, expected.ticker);
    assert.equal(project.resolution.mode, "registered");
    assert.equal(project.resolution.source, "curated");
    assert.deepEqual(project.resolution.normalized, { slug:expected.slug, ticker:expected.ticker });
  }
});

test("resolver returns a minimal runtime fallback skeleton for unregistered tickers", async () => {
  for (const input of ["doge", "pepe", "link"]) {
    const project = await resolveProject(input, noDiscoveryCalls);
    const slug = input.toLowerCase();
    const ticker = input.toUpperCase();

    assert.equal(project.slug, slug);
    assert.equal(project.ticker, ticker);
    assert.equal(project.projectType, "runtime");
    assert.deepEqual(project.categories, []);
    assert.deepEqual(project.resolution, {
      mode: "runtime",
      source: "fallback",
      input,
      normalized: { slug, ticker },
    });
  }
});

test("runtime skeleton normalizes mixed-case and name-shaped input", () => {
  const project = buildRuntimeProjectSkeleton("  Example Token  ");
  assert.equal(project.slug, "example-token");
  assert.equal(project.ticker, "EXAMPLE-TOKEN");
  assert.equal(project.resolution.input, "Example Token");
  assert.deepEqual(project.resolution.normalized, { slug:"example-token", ticker:"EXAMPLE-TOKEN" });
});

test("empty project input does not produce a fallback", async () => {
  assert.equal(await resolveProject("   "), null);
  assert.equal(buildRuntimeProjectSkeleton(null), null);
});
