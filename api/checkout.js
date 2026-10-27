const { createWhopCheckout } = require("../lib/whop");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const email = request.body && typeof request.body.email === "string"
    ? request.body.email.trim()
    : "";
  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return response.status(400).json({ error: "Enter a valid email address." });
  }

  try {
    const result = await createWhopCheckout(email);
    return response.status(200).json(result);
  } catch (error) {
    console.error("Whop checkout error:", error.message);
    return response.status(502).json({ error: "Checkout could not be created. Please try again later." });
  }
};
