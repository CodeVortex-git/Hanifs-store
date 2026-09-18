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
