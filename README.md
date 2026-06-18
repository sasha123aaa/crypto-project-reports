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

Сейчас сайт может показывать расчет стратегии без базы данных.

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

4. Применить миграции в удаленную базу:

```bash
npx wrangler d1 migrations apply crypto_strategy_trades --remote
```

5. Сделать деплой:

```bash
npx wrangler deploy --config wrangler.toml
```

6. Проверить статус:

```text
/api/strategy/status
```

Если все подключено правильно, в ответе будет:

```json
{
  "dbAvailable": true,
  "monitorActive": true
}
```

Если база не подключена, сайт продолжит работать, но будет показывать только расчет плана без сохранения сделок.

## Ручной запуск монитора стратегии

Для ручной проверки можно задать секрет:

```bash
npx wrangler secret put STRATEGY_ADMIN_KEY
```

После деплоя можно запустить монитор:

```text
/api/strategy/run-monitor?key=YOUR_SECRET
```

После запуска проверить:

```text
/api/strategy/status
/api/strategy/active
/api/strategy/stats?symbol=CRV
```
