const API_BASE = "https://api.whop.com/api/v1";

function getWhopConfig() {
  const { WHOP_API_KEY, WHOP_COMPANY_ID } = process.env;
  if (!WHOP_API_KEY && !WHOP_COMPANY_ID) return null;
  if (!WHOP_API_KEY || !WHOP_COMPANY_ID) {
    throw new Error("Both WHOP_API_KEY and WHOP_COMPANY_ID are required.");
  }

  const price = Number(process.env.WHOP_PRICE ?? "0");
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("WHOP_PRICE must be a non-negative number.");
  }

  const billingPeriod = process.env.WHOP_BILLING_PERIOD_DAYS;
  if (billingPeriod && (!Number.isInteger(Number(billingPeriod)) || Number(billingPeriod) < 1)) {
    throw new Error("WHOP_BILLING_PERIOD_DAYS must be a positive whole number.");
  }
  if (billingPeriod && price === 0) {
    throw new Error("WHOP_PRICE must be greater than zero for a recurring plan.");
  }

  return {
    apiKey: WHOP_API_KEY,
    companyId: WHOP_COMPANY_ID,
    currency: (process.env.WHOP_CURRENCY || "usd").toLowerCase(),
    price,
    billingPeriod: billingPeriod ? Number(billingPeriod) : null,
  };
}

async function createWhopCheckout(email) {
  const config = getWhopConfig();
  if (!config) return { demo: true };

  const plan = {
    company_id: config.companyId,
    currency: config.currency,
    plan_type: config.billingPeriod ? "renewal" : config.price === 0 ? "free" : "one_time",
    title: "AI Money Membership",
    description: "Membership for AI Money economic insights.",
    product: {
      external_identifier: "ai-money-membership",
      title: "AI Money",
      description: "Membership for AI Money economic insights.",
    },
  };
  if (config.billingPeriod) {
    plan.billing_period = config.billingPeriod;
    plan.renewal_price = config.price;
  } else if (config.price > 0) {
    plan.initial_price = config.price;
  }

  const response = await fetch(`${API_BASE}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "payment",
      plan,
      redirect_url: process.env.WHOP_REDIRECT_URL || undefined,
      metadata: email ? { customer_email: email } : undefined,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : "Whop checkout could not be created.";
    throw new Error(`Whop API returned ${response.status}: ${message}`);
  }

  const checkoutUrl = payload.purchase_url
    || payload.checkout_url
    || payload.url
    || payload.checkout_configuration?.url;
  if (typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://")) {
    throw new Error("Whop created a checkout configuration without a valid HTTPS checkout URL.");
  }
  return { demo: false, checkoutUrl };
}

module.exports = { createWhopCheckout };
