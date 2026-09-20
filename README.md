# Hanifs-store

A premium fashion e-commerce storefront built with vanilla HTML, CSS, and JavaScript, featuring a modern black, white, and gold design system and Nigerian-focused shopping experience.

## Backend scaffold

The Express backend lives in `backend/` and currently exposes:

- `GET /api/health`
- `POST /api/orders`
- `GET /api/orders/:id`
- `POST /api/payments/initialize`
- `POST /api/payments/verify`

Order and payment endpoints intentionally return development placeholders. The future flow is:

`Frontend -> Backend API -> Database -> Payment provider`

The browser may submit requested product IDs, variants, quantities, and customer delivery information, but the backend must independently retrieve authoritative products, validate stock and prices, calculate totals, create orders, and verify payment. `PAYSTACK_SECRET_KEY` belongs only in the backend environment and must never be exposed to frontend code. Payment confirmation must come from a trusted provider/backend flow, not browser state.

Copy `backend/.env.example` to a local environment file when running the server. Do not commit `.env`.

### Running the backend

```bash
npm start     # node backend/server.js
npm run server # same as npm start
npm run dev   # node --watch backend/server.js (restarts on file changes)
```

The API listens on `PORT` (default `5000`). There is no build step for the
frontend — `index.html`, `script.js`, and `style.css` are served directly.

### Endpoint status for this milestone

| Method | Endpoint | Status | Behaviour |
| --- | --- | --- | --- |
| GET | `/api/health` | Working | `{ success: true, message: "HANIF'S STORE API is running" }` |
| POST | `/api/orders` | Placeholder | `501` — persistent order storage is not implemented yet |
| GET | `/api/orders/:id` | Placeholder | `501` — persistent order storage is not implemented yet |
| POST | `/api/payments/initialize` | Placeholder | `501` — payment integration is not yet configured |
| POST | `/api/payments/verify` | Placeholder | `501` — payment integration is not yet configured |

Placeholder endpoints never return a fake order id, a fake total, or a fake
payment success. Any endpoint or API route that does not exist returns a JSON
`404`; malformed JSON bodies return a JSON `400`. Errors are always JSON and
never expose stack traces.

### HTTP status code convention

- `200` — success
- `400` — invalid request (e.g. malformed JSON)
- `404` — unknown route
- `500` — unexpected server error
- `501` — endpoint reserved but capability not implemented yet

### Trust boundary and security rules

The frontend must **not** be trusted as the authority for product prices, final
totals, stock levels, payment status, or order status. Those values must be
determined independently by the backend and, once it exists, the database.

- The frontend should eventually send only product IDs, quantities, selected
  variants, and customer/shipping information.
- The backend will later retrieve authoritative product data from the database
  and recalculate every price and total server-side.
- Client-supplied prices, totals, stock figures, and statuses must be discarded.
- Payment state must be confirmed server-to-server with the provider; a
  browser-supplied "paid" flag is never proof of payment.
- Payment credentials live only in `backend/.env` (untracked) and are read by
  `backend/services/paystackService.js`. They must never reach frontend code.

### Local development CORS

The static frontend and the API run on different local origins during
development, so `backend/server.js` applies a CORS allowlist covering
`localhost`/`127.0.0.1` on ports `3000` and `5500` (common static-server ports).
Override the allowlist by setting `CORS_ORIGINS` as a comma-separated list in
`backend/.env`. The configuration is deliberately narrow and contains no
permissive production setting.

### Out of scope for this milestone

Database, authentication, user accounts, real Paystack/Flutterwave calls,
payment verification, webhooks, admin dashboard, inventory, real order
persistence, email/SMS, and delivery calculation are intentionally not
implemented yet. The centralised order and payment status values they will use
already exist in `backend/constants/statuses.js`.
