# AI Money

A polished fintech prototype for money insights and Whop-powered membership checkout. It is not a bank, does not hold funds, issue cards, connect bank accounts, or provide regulated financial advice. The demo profile and transactions are stored only in the current browser.

## Run locally

Requires Node.js 18 or newer. No npm dependencies are needed.

```sh
node server.js
```

Open [http://localhost:3000](http://localhost:3000). Without Whop credentials the checkout route returns an explicit demo response; the rest of the app can be explored locally.

## Whop checkout

Create a Whop API key with `checkout_configuration:create`, `plan:create`, `access_pass:create`, `access_pass:update`, and `checkout_configuration:basic:read` permissions, and identify the Whop company that will own the AI Money membership. Configure these environment variables on Vercel (and locally if needed):

| Variable | Description |
| --- | --- |
| `WHOP_API_KEY` | Secret API key. Keep it server-side; never expose it as a `VITE_` or `NEXT_PUBLIC_` variable. |
| `WHOP_COMPANY_ID` | Company ID that owns the membership plan. |
| `WHOP_CURRENCY` | Optional currency code; defaults to `usd`. |
| `WHOP_PRICE` | Membership price in dollars; defaults to `0` for a one-time plan. For a recurring plan, set a positive amount. |
| `WHOP_BILLING_PERIOD_DAYS` | Optional renewal interval in days; omit for a one-time checkout. |
| `WHOP_REDIRECT_URL` | Optional HTTPS URL for customers to return to after checkout. |

When configured, onboarding creates a Whop checkout configuration through `POST https://api.whop.com/api/v1/checkout_configurations` with an inline AI Money product and plan, then redirects the user to the returned checkout URL. Customers complete payment and account creation through Whop. Confirm the plan, pricing, permissions, and Whop's current API requirements in your account before launch. The app does not yet provision a regulated bank account or persist user sessions on a server.

## Economic model

The optional TensorFlow training script (Python 3.10–3.13) fetches historical World Bank indicators for the United States, trains a small neural network to estimate next-year CPI inflation from the previous year's CPI inflation, GDP growth, and unemployment, then exports portable weights for the app's client-side inference.

```sh
python -m pip install -r requirements-model.txt
python train_model.py
```

The generated `economic-model.json` is intentionally not committed: it is reproducible and is generated from the latest available public observations. Until the model is trained, the app labels its economic insight as an illustrative demo rather than a model forecast. This small, single-country model is experimental, trained from scratch rather than fine-tuned from a pretrained model, and must not be used as investment, credit, or financial advice.

## Deploy to Vercel

Import the repository into Vercel and deploy the static site. The `api/checkout.js` serverless function is available at `/api/checkout`; add the Whop environment variables in the Vercel project settings. Optionally run the model training script before deployment and include the generated JSON in the deployment. Set `WHOP_PRICE` and billing period only after deciding on an actual membership offer.

## Important launch requirements

This is a prototype, not a production banking or financial product. Real user accounts require a secure auth provider and durable database. Bank data, deposits, cards, and money movement require appropriately licensed banking/payments partners and compliance work. Do not collect bank credentials or represent the demo balance as real funds.
