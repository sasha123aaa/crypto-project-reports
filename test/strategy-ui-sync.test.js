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
