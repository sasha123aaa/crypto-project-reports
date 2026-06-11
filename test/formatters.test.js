import test from "node:test";
import assert from "node:assert/strict";
import { formatCompactNumber, formatMoney, formatMultiple, formatPercent } from "../src/lib/formatters.js";

test("compact numbers use K/M/B/T with at most two meaningful decimal places", () => {
  assert.equal(formatCompactNumber(845300), "845.3K");
  assert.equal(formatCompactNumber(120684325), "120.68M");
  assert.equal(formatCompactNumber(13310000000), "13.31B");
  assert.equal(formatCompactNumber(156830000000), "156.83B");
  assert.equal(formatCompactNumber(1250000000000), "1.25T");
  assert.equal(formatCompactNumber(999999999), "1B");
});

test("currency, percent, and multiple formatters retain their semantic markers", () => {
  assert.equal(formatMoney(200470000000), "$200.47B");
  assert.equal(formatMoney(13310000000), "$13.31B");
  assert.equal(formatPercent(5.13), "5.13%");
  assert.equal(formatMultiple(3.03), "3.03x");
});

test("compact formatter only accepts actual finite numbers", () => {
  assert.equal(formatCompactNumber("120684325"), "—");
  assert.equal(formatCompactNumber(null), "—");
  assert.equal(formatCompactNumber(Number.NaN), "—");
});
