# Crypto Project Reports.

Универсальный каркас для живых разборов криптопроектов через Cloudflare Workers + Assets.

## Что внутри
- один общий шаблон страницы отчета
- API `/api/report/:slug`
- карта проектов в `src/config/projects.js`
- адаптеры для CoinGecko, DefiLlama и Bybit
- docs для GPT Project
- стартовые JSON-файлы в `data/reports/`

## Быстрый старт
1. Залей структуру в GitHub
2. Подключи репозиторий к Cloudflare Workers
3. Убедись, что `wrangler.toml` читает `public` как assets
4. Открой:
   - `/`
   - `/reports/?slug=eth`
   - `/api/report/eth`
