# Codex Project Instructions

## Project
crypto-project-reports

## Goal
Create a premium live crypto project report system powered by Cloudflare Workers + Assets.
Each report opens by URL like `/reports/?slug=eth`.

## Core architecture
- unified JSON schema
- unified frontend renderer
- unified API adapters
- shared visual template
- backend must stay aligned with frontend
- no breaking route changes

## Current priorities
1. correctness of data
2. honest charts
3. premium UI
4. interactivity
5. extensibility for future slugs

## Critical product rules
- Do not show misleading charts.
- If multiple time series are compared, they must either:
  - use the same valid time window
  - or be normalized on a shared overlapping period
- If data is missing, show a clean placeholder instead of fake values.
- TradingView is the primary price chart.
- Avoid duplicate charts that add no value.

## Technical analysis block
The "Быстрый теханализ" block must eventually use the real project range logic.
Do not invent a simplified replacement and present it as final logic.
If the range logic is not yet integrated, keep the block conservative and do not overclaim correctness.

## Users block
Users metrics may remain placeholder/partial until a stable live source is connected.
Prefer honest fallback over fake precision.

## Stablecoins block
Stablecoins metrics should be live when possible.
If the source is unavailable, fallback must be explicit and visually correct.

## UI rules
- dark premium style
- clean spacing
- consistent cards
- no clutter
- useful interactivity only
- support info tooltips for complex metrics

## Required checks after edits
- `/reports/?slug=eth` loads
- `/api/report/eth` returns valid JSON
- TradingView renders
- charts are not empty unless source is unavailable
- status chips are correct
- frontend and backend remain compatible

## When finishing a task
Always report:
- changed files
- what was fixed
- what still remains unresolved
