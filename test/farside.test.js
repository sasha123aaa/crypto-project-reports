import test from "node:test";
import assert from "node:assert/strict";
import { fetchBitcoinEtfFlows, parseBitcoinEtfFlowHtml } from "../src/adapters/farside.js";

const html = `<table><thead><tr><th>Date</th><th>IBIT</th><th>Total</th></tr></thead><tbody>
<tr><td>10 Jun 2026</td><td>10.0</td><td>(20.5)</td></tr>
<tr><td>11 Jun 2026</td><td>30.0</td><td>25.5</td></tr>
<tr><td>12 Jun 2026</td><td>-</td><td>-</td></tr>
</tbody></table>`;

test("Farside parser reads dated aggregate flows and parentheses as outflows", () => {
  assert.deepEqual(parseBitcoinEtfFlowHtml(html), [
    [Date.parse("2026-06-10T00:00:00Z"), -20_500_000],
    [Date.parse("2026-06-11T00:00:00Z"), 25_500_000],
  ]);
});

test("Farside adapter exposes latest, recent, cumulative, and chart flow data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(html, { status:200 });
  try {
    const result = await fetchBitcoinEtfFlows({ days:10_000 });
    assert.equal(result.current.latestNetFlow, 25_500_000);
    assert.equal(result.current.recentFiveDayNet, 5_000_000);
    assert.equal(result.current.cumulativeNetFlow, 5_000_000);
    assert.equal(result.charts.daily.length, 2);
    assert.equal(result.charts.cumulative.at(-1)[1], 5_000_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
