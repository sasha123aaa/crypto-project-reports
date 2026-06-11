import test from "node:test";
import assert from "node:assert/strict";
import {
  ANALYSIS_PROFILES,
  CAPABILITY_DEFAULTS,
  PROJECT_CATEGORIES,
  PROJECTS,
  SECTION_RULES,
  getEligibleSections,
  getProjectProfile,
} from "../src/config/projects.js";

test("project taxonomy exposes the stage-one categories", () => {
  assert.deepEqual(Object.values(PROJECT_CATEGORIES), ["infra", "defi", "meme", "utility", "consumer"]);
});

test("ETH resolves to a capability-rich L1 infrastructure profile", () => {
  const profile = getProjectProfile(PROJECTS.eth);

  assert.equal(profile.category, PROJECT_CATEGORIES.INFRA);
  assert.equal(profile.analysisProfile, ANALYSIS_PROFILES.L1_INFRA);
  assert.equal(profile.capabilities.hasTvl, true);
  assert.equal(profile.capabilities.hasStablecoins, true);
  assert.equal(profile.capabilities.hasProtocolFees, true);
  assert.equal(profile.capabilities.hasChainFees, true);
  assert.equal(profile.capabilities.hasUsersData, true);
  assert.equal(profile.capabilities.hasTokenomics, true);
  assert.equal(profile.capabilities.hasUnlocks, false);
  assert.ok(profile.preferredSections.includes("tvl_and_capital"));
  assert.ok(profile.eligibleSections.includes("financials"));
});

test("SOL is available as a second infrastructure profile", () => {
  const profile = getProjectProfile(PROJECTS.sol);

  assert.equal(profile.category, PROJECT_CATEGORIES.INFRA);
  assert.equal(profile.analysisProfile, ANALYSIS_PROFILES.L1_INFRA);
  assert.equal(profile.capabilities.hasDexVolume, true);
});

test("section eligibility is driven by declared capability rules", () => {
  assert.deepEqual(SECTION_RULES.tvl_and_capital.requiredAny, ["hasTvl"]);
  assert.deepEqual(SECTION_RULES.financials.requiredAny, ["hasProtocolFees", "hasChainFees"]);
  assert.deepEqual(SECTION_RULES.narrative_and_news.requiredAny, ["hasNarrativeNews"]);

  const sections = getEligibleSections({ ...CAPABILITY_DEFAULTS, hasChainFees: true });
  assert.ok(sections.includes("market"));
  assert.ok(sections.includes("financials"));
  assert.ok(sections.includes("risks_and_verdict"));
  assert.ok(!sections.includes("tvl_and_capital"));
});
