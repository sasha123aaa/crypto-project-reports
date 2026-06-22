import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateLevels } from '../public/assets/strategy-engine.js';

const radarJs = fs.readFileSync(new URL('../public/assets/bull-radar.js', import.meta.url), 'utf8');
const chartJs = fs.readFileSync(new URL('../public/assets/trade-plan-chart.js', import.meta.url), 'utf8');
const tradePlanJs = fs.readFileSync(new URL('../public/assets/trade-plan.js', import.meta.url), 'utf8');
const range = { aPrice: 100, bPrice: 80, bullish: true, aTime: 1, bTime: 2 };

test('radar selected chart uses canonical /api/strategy/plan source and same strategy mode params', () => {
  assert.match(radarJs, /function canonicalStrategyKey\(row\)[\s\S]*resolveRadarStrategyMode\(row\)/);
  assert.match(radarJs, /fetch\(`\/api\/strategy\/plan\?\$\{params\.toString\(\)\}`/);
  assert.match(radarJs, /entryMode:String\(resolveRadarStrategyMode\(row\)\)/);
  assert.match(radarJs, /const strategy = completed \? null : canonicalStrategy/);
  assert.match(tradePlanJs, /entryMode:String\(selectedStrategyEntryMode\(\)\)/);
});

test('completed take-hit ranges are not drawn as ready radar opportunities', () => {
  assert.match(radarJs, /strategy\?\.status === "take_hit" \|\| strategy\?\.completed/);
  assert.match(radarJs, /return "Диапазон отработан"/);
  assert.match(radarJs, /activeStrategyTrade:strategy/);
  assert.match(radarJs, /Диапазон уже завершён по тейку\. Ожидаем формирования нового диапазона\./);
  assert.match(radarJs, /rawRows = rawRows\.filter\(\(item\) => item\.id !== row\.id\)/);
});

test('activated and averaging radar statuses take priority over distance to entry', () => {
  const statusBody = radarJs.match(/function radarStrategyStatus\([\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(statusBody.indexOf('activated > 1') < statusBody.indexOf('absDistance <= 1'));
  assert.ok(statusBody.indexOf('activated === 1') < statusBody.indexOf('absDistance <= 1'));
  assert.match(statusBody, /return "На усреднении"/);
  assert.match(statusBody, /return "Активирована"/);
});

test('strategy modes expose expected valid level counts without synthetic levels', () => {
  assert.equal(calculateLevels({ range, entryMode: 0.31 }).filter((level) => level.valid !== false && Number(level.price) > 0).length, 12);
  assert.equal(calculateLevels({ range, entryMode: 0.5 }).filter((level) => level.valid !== false && Number(level.price) > 0).length, 11);
  assert.equal(calculateLevels({ range, entryMode: 0.75 }).filter((level) => level.valid !== false && Number(level.price) > 0).length, 10);
});

test('all valid strategy levels receive price-scale labels and invalid levels are excluded', () => {
  assert.match(chartJs, /shouldShowStrategyLevelLabel\(level,index,trade\)\{const price=Number\(level\?\.price\);return level\?\.valid!==false&&Number\.isFinite\(price\)&&price>0\}/);
  assert.match(chartJs, /if\(level\?\.valid===false\|\|!Number\.isFinite\(price\)\|\|price<=0\)return/);
  assert.match(chartJs, /axisLabelVisible:true,title:level\.label\|\|\(index===0\?"Вход":`Уср\. \$\{index\}`\)/);
});

test('all-level scale includes current price, levels, average, take, A, and B', () => {
  assert.match(chartJs, /fitAllStrategyLevels\(\)/);
  assert.match(chartJs, /Number\(this\.getLastCandle\(\)\?\.close\)/);
  assert.match(chartJs, /Number\(trade\.takePrice\)/);
  assert.match(chartJs, /Number\(trade\.averagePrice\)/);
  assert.match(chartJs, /Number\(this\.range\?\.aPrice\)/);
  assert.match(chartJs, /Number\(this\.range\?\.bPrice\)/);
  assert.match(chartJs, /data-strategy-scale=\"all\"/);
  assert.match(chartJs, /data-strategy-scale=\"near\"/);
});

const css = fs.readFileSync(new URL('../public/assets/app.css', import.meta.url), 'utf8');

function methodBody(source, name) {
  const start = source.indexOf(`  ${name}(`);
  assert.notEqual(start, -1, `${name} not found`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  return '';
}

test('strategy UI overlay is absolutely positioned and controls keep pointer events', () => {
  assert.match(css, /\.strategy-ui-overlay\s*\{[\s\S]*position:\s*absolute/);
  assert.match(css, /\.strategy-scale-controls\s*\{[\s\S]*pointer-events:\s*auto/);
  assert.match(css, /\.trade-chart-info\s*\{[\s\S]*top:\s*42px/);
});

test('strategy UI elements are appended as overlay after chart creation', () => {
  const chartIndex = chartJs.indexOf('LightweightCharts.createChart');
  const uiAppendIndex = chartJs.indexOf('this.plot.appendChild(this.strategyUiOverlay)');
  assert.ok(chartIndex >= 0 && uiAppendIndex > chartIndex);
  assert.doesNotMatch(chartJs, /this\.plot\.appendChild\(this\.strategyLevelsMeta\)/);
  assert.doesNotMatch(chartJs, /this\.plot\.appendChild\(this\.strategyScaleControls\)/);
  assert.match(chartJs, /this\.strategyUiOverlay\.append\(this\.strategyLevelsMeta,this\.strategyScaleControls\)/);
});

test('strategy level scale methods do not alter the time scale or chart data', () => {
  for (const name of ['setStrategyLevelScaleMode', 'fitAllStrategyLevels', 'applyStrategyLevelScale']) {
    const body = methodBody(chartJs, name);
    assert.doesNotMatch(body, /fitContent\s*\(/);
    assert.doesNotMatch(body, /setVisibleLogicalRange\s*\(/);
    assert.doesNotMatch(body, /timeScale\(\)[\s\S]*setVisibleRange\s*\(/);
    assert.doesNotMatch(body, /applyDefaultView\s*\(/);
    assert.doesNotMatch(body, /series\.setData\s*\(/);
  }
  assert.match(methodBody(chartJs, 'fitAllStrategyLevels'), /priceScale\?\.setVisibleRange\?\.\(/);
});

test('radar chart preserves row candles and row range and guards canonical range mismatches', () => {
  assert.match(radarJs, /candles:row\.candles/);
  assert.match(radarJs, /range:row\.range/);
  assert.match(radarJs, /function sameRange\(left, right\)/);
  assert.match(radarJs, /canonicalRange && !sameRange\(row\.range, canonicalRange\)/);
});
