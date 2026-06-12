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
  getSectionSelection,
  SECTION_VISIBILITY,
} from "../src/config/projects.js";

test("project taxonomy exposes the stage-one categories", () => {
  assert.deepEqual(Object.values(PROJECT_CATEGORIES), ["infra", "macro", "defi", "meme", "utility", "consumer", "hybrid_ecosystem", "trading_venue"]);
});


test("BTC is a curated macro asset profile without ETH-like capabilities", () => {
  const profile = getProjectProfile(PROJECTS.btc);
  const selection = getSectionSelection(PROJECTS.btc);

  assert.equal(profile.category, PROJECT_CATEGORIES.MACRO);
  assert.equal(profile.analysisProfile, ANALYSIS_PROFILES.MACRO_ASSET);
  assert.equal(profile.capabilities.hasTokenomics, true);
  assert.equal(profile.capabilities.hasLiquidityData, true);
  for (const capability of ["hasTvl", "hasStablecoins", "hasProtocolFees", "hasChainFees", "hasDexVolume"]) assert.equal(profile.capabilities[capability], false);
  for (const section of ["market", "tokenomics", "liquidity_and_trading", "valuation", "narrative_and_news", "risks", "final_summary"]) assert.ok(selection.enabledSections.includes(section));
  for (const section of ["tvl_and_capital", "stablecoins", "financials", "users_and_activity"]) assert.equal(selection.sections[section].status, SECTION_VISIBILITY.DISABLED_BY_PROFILE);
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

test("BNB is a curated CEX + chain hybrid profile", () => {
  const profile = getProjectProfile(PROJECTS.bnb);
  const selection = getSectionSelection(PROJECTS.bnb);

  assert.equal(profile.category, PROJECT_CATEGORIES.HYBRID_ECOSYSTEM);
  assert.equal(profile.analysisProfile, ANALYSIS_PROFILES.CEX_CHAIN_HYBRID);
  for (const capability of ["hasTvl", "hasStablecoins", "hasChainFees", "hasDexVolume", "hasTokenomics", "hasLiquidityData", "hasTokenUtilityData"]) assert.equal(profile.capabilities[capability], true);
  assert.equal(profile.capabilities.hasUsersData, false);
  for (const section of ["market", "tokenomics", "financials", "tvl_and_capital", "stablecoins", "liquidity_and_trading", "final_summary", "risks", "narrative_and_news"]) assert.ok(selection.enabledSections.includes(section));
  for (const section of ["users_and_activity", "rwa", "unlocks", "whale_activity"]) assert.equal(selection.sections[section].status, SECTION_VISIBILITY.DISABLED_BY_PROFILE);
});

test("SOL is available as a second infrastructure profile", () => {
  const profile = getProjectProfile(PROJECTS.sol);

  assert.equal(profile.category, PROJECT_CATEGORIES.INFRA);
  assert.equal(profile.analysisProfile, ANALYSIS_PROFILES.L1_INFRA);
  assert.equal(profile.capabilities.hasDexVolume, true);
  assert.equal(profile.capabilities.hasUsersData, false);

  const selection = getSectionSelection(PROJECTS.sol);
  assert.equal(selection.sections.users_and_activity.status, SECTION_VISIBILITY.DISABLED_BY_MISSING_DATA);
  assert.ok(!selection.enabledSections.includes("users_and_activity"));
});

test("section eligibility is driven by declared capability rules", () => {
  assert.deepEqual(SECTION_RULES.tvl_and_capital.requiredAny, ["hasTvl"]);
  assert.deepEqual(SECTION_RULES.financials.requiredAny, ["hasProtocolFees", "hasChainFees"]);
  assert.deepEqual(SECTION_RULES.narrative_and_news.requiredAny, ["hasNarrativeNews"]);

  const sections = getEligibleSections({ ...CAPABILITY_DEFAULTS, hasChainFees: true });
  assert.ok(sections.includes("market"));
  assert.ok(sections.includes("financials"));
  assert.ok(sections.includes("risks"));
  assert.ok(sections.includes("final_summary"));
  assert.ok(!sections.includes("tvl_and_capital"));
});

test("preferred sections disable otherwise eligible sections by profile", () => {
  const project = {
    projectProfile: {
      capabilities: { hasTvl: true, hasTokenomics: true },
      preferredSections: ["market", "tokenomics", "risks", "final_summary"],
    },
  };

  const selection = getSectionSelection(project);
  assert.equal(selection.sections.tokenomics.status, SECTION_VISIBILITY.ENABLED);
  assert.equal(selection.sections.tvl_and_capital.status, SECTION_VISIBILITY.DISABLED_BY_PROFILE);
  assert.equal(selection.sections.financials.status, SECTION_VISIBILITY.DISABLED_BY_PROFILE);
});

test("available profile sections can be marked partial or disabled by report data", () => {
  const selection = getSectionSelection(PROJECTS.eth, {
    tokenomics: "partial",
    financials: false,
  });

  assert.equal(selection.sections.tokenomics.status, SECTION_VISIBILITY.PARTIAL);
  assert.equal(selection.sections.financials.status, SECTION_VISIBILITY.DISABLED_BY_MISSING_DATA);
  assert.ok(selection.enabledSections.includes("tokenomics"));
  assert.ok(!selection.enabledSections.includes("financials"));
});

test("LINK is a curated oracle utility profile without chain-capital capabilities", () => {
  const profile = getProjectProfile(PROJECTS.link);
  const selection = getSectionSelection(PROJECTS.link);

  assert.equal(profile.category, PROJECT_CATEGORIES.UTILITY);
  assert.equal(profile.analysisProfile, ANALYSIS_PROFILES.ORACLE_UTILITY);
  for (const capability of ["hasTokenomics", "hasLiquidityData", "hasTokenUtilityData", "hasAdoptionData", "hasNarrativeNews"]) assert.equal(profile.capabilities[capability], true);
  for (const capability of ["hasTvl", "hasStablecoins", "hasRwa", "hasProtocolFees", "hasChainFees", "hasDexVolume", "hasUsersData"]) assert.equal(profile.capabilities[capability], false);
  assert.ok(selection.enabledSections.includes("utility_and_adoption"));
  for (const section of ["tvl_and_capital", "stablecoins", "rwa", "financials", "users_and_activity"]) assert.equal(selection.sections[section].status, SECTION_VISIBILITY.DISABLED_BY_PROFILE);
});

test("HYPE is a curated trading venue growth and revenue profile", () => {
  const profile = getProjectProfile(PROJECTS.hype);
  assert.equal(profile.category, "trading_venue");
  assert.equal(profile.analysisProfile, "trading_economics");
  assert.equal(profile.capabilities.hasProtocolFees, true);
  assert.equal(profile.capabilities.hasDexVolume, true);
  assert.equal(profile.capabilities.hasValueCaptureData, true);
  assert.deepEqual(profile.preferredSections, ["market", "tokenomics", "financials", "liquidity_and_trading", "tvl_and_capital", "stablecoins", "final_summary", "risks", "narrative_and_news"]);
});

test("PENDLE and CRV use the product-driven DeFi economics template with project-specific capabilities", () => {
  const pendle = getProjectProfile(PROJECTS.pendle);
  const crv = getProjectProfile(PROJECTS.crv);
  assert.equal(pendle.category, PROJECT_CATEGORIES.DEFI);
  assert.equal(crv.category, PROJECT_CATEGORIES.DEFI);
  assert.equal(pendle.analysisProfile, ANALYSIS_PROFILES.PRODUCT_DEFI_ECONOMICS);
  assert.equal(crv.analysisProfile, ANALYSIS_PROFILES.PRODUCT_DEFI_ECONOMICS);
  for (const profile of [pendle, crv]) {
    assert.equal(profile.capabilities.hasTvl, true);
    assert.equal(profile.capabilities.hasProtocolFees, true);
    assert.equal(profile.capabilities.hasDexVolume, true);
    assert.equal(profile.capabilities.hasTokenomics, true);
  }
  assert.equal(pendle.capabilities.hasUnlocks, false);
  assert.equal(crv.capabilities.hasUnlocks, true);
});
