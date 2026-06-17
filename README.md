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

## Strategy memory / D1

Память виртуальных сделок работает через Cloudflare D1.

Чтобы включить:

```bash
npx wrangler d1 create crypto_strategy_trades
```

После создания Cloudflare вернет `database_id`.

Вставить его в `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "crypto_strategy_trades"
database_id = "REAL_DATABASE_ID"
```

Применить миграции:

```bash
npx wrangler d1 migrations apply crypto_strategy_trades
```

Если D1 не подключен, сайт продолжает работать, но блок памяти стратегии показывает, что база не настроена.
