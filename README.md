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

## Подключение памяти стратегии через Cloudflare D1

Сайт может показывать расчет стратегии без базы данных.

Чтобы включить сохранение виртуальных сделок:

1. Создать D1-базу:

```bash
npx wrangler d1 create crypto_strategy_trades
```

2. Скопировать `database_id`, который вернет Cloudflare.

3. Вставить его в `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "crypto_strategy_trades"
database_id = "REAL_DATABASE_ID"
```

4. Применить миграции:

```bash
npx wrangler d1 migrations apply crypto_strategy_trades --remote
```

5. Задать секрет для ручного запуска монитора:

```bash
npx wrangler secret put STRATEGY_ADMIN_KEY
```

6. Сделать деплой:

```bash
npx wrangler deploy --config wrangler.toml
```

7. Проверить статус:

```text
/api/strategy/status
```

8. Ручной запуск монитора:

```text
/api/strategy/run-monitor?key=YOUR_SECRET
```

Если D1 не подключен, сайт продолжает работать, но показывает только расчет плана без сохранения сделок.

