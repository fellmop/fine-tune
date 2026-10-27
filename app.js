const transactions = [
  { icon: "↗", tone: "", title: "Friday Studio", category: "Income · Freelance", date: "Today", amount: "+$1,250.00" },
  { icon: "⌂", tone: "pink", title: "Sunday Market", category: "Shopping · Food", date: "Yesterday", amount: "−$84.20" },
  { icon: "✳", tone: "blue", title: "Northstar Health", category: "Wellness · Monthly", date: "Oct 24", amount: "−$38.00" },
  { icon: "▣", tone: "yellow", title: "The Daily Press", category: "Coffee · Food", date: "Oct 23", amount: "−$12.50" },
];

const modal = document.querySelector("#signup-modal");
const form = document.querySelector("#signup-form");
const toast = document.querySelector("#toast");
const signupButton = document.querySelector("#signup-submit");
let toastTimeout;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 3800);
}

function renderTransactions() {
  const list = document.querySelector("#transaction-list");
  list.innerHTML = transactions.map((item) => `
    <div class="transaction-row">
      <span class="transaction-icon ${item.tone}">${item.icon}</span>
      <span class="transaction-details"><strong>${item.title}</strong><span>${item.category}</span></span>
      <span class="transaction-date">${item.date}</span>
      <span class="transaction-amount">${item.amount}</span>
    </div>`).join("");
}

function applyProfile(profile) {
  if (!profile) return;
  const name = profile.name || "Friend";
  const firstName = name.trim().split(/\s+/)[0];
  const initial = firstName.slice(0, 1).toUpperCase();
  document.querySelector("#sidebar-name").textContent = name;
  document.querySelector("#sidebar-avatar").textContent = initial;
  document.querySelector("#top-avatar").textContent = initial;
  document.querySelector("#greeting").textContent = `Money, in a new light, ${firstName}.`;
  document.querySelector("#insight-title").textContent = `You’re off to a good start, ${firstName}.`;
  document.querySelector("#insight-copy").textContent = "Your demo profile is ready. Add a real, authorized data connection when you choose a regulated provider.";
}

function openSignup() {
  document.querySelector("#form-error").textContent = "";
  modal.showModal();
}

document.querySelectorAll("#add-money, #profile-button, #top-avatar").forEach((button) => {
  button.addEventListener("click", openSignup);
});
document.querySelector("#close-modal").addEventListener("click", () => modal.close());
modal.addEventListener("click", (event) => {
  if (event.target === modal) modal.close();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const profile = {
    name: String(data.get("name") || "").trim(),
    email: String(data.get("email") || "").trim().toLowerCase(),
  };
  if (!profile.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    document.querySelector("#form-error").textContent = "Add your name and a valid email address.";
    return;
  }

  signupButton.disabled = true;
  signupButton.textContent = "Setting up your preview…";
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: profile.email }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not start checkout.");
    localStorage.setItem("ai-money-profile", JSON.stringify(profile));
    applyProfile(profile);
    modal.close();
    if (result.checkoutUrl) {
      window.location.assign(result.checkoutUrl);
      return;
    }
    showToast("Demo profile saved on this browser. No real account or bank account was created.");
  } catch (error) {
    document.querySelector("#form-error").textContent = error.message || "Something went wrong. Please try again.";
  } finally {
    signupButton.disabled = false;
    signupButton.innerHTML = 'Create your demo profile <span>→</span>';
  }
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
    const title = view === "intelligence" ? "Intelligence" : view === "activity" ? "Activity" : "Overview";
    document.querySelector("#page-title").textContent = title;
    if (view === "intelligence") {
      document.querySelector("#model-copy").textContent = "An experimental, educational macroeconomic signal—not a personal prediction or financial recommendation.";
      document.querySelector(".economic-card").scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (view === "activity") {
      document.querySelector(".activity-card").scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
});

document.querySelector("#toggle-balance").addEventListener("click", (event) => {
  const value = document.querySelector("#balance-value");
  const cents = document.querySelector(".cents");
  const hidden = event.currentTarget.dataset.hidden === "true";
  value.textContent = hidden ? "12,840" : "••••••";
  cents.hidden = !hidden;
  event.currentTarget.dataset.hidden = String(!hidden);
  event.currentTarget.setAttribute("aria-label", hidden ? "Hide balance" : "Show balance");
});

async function loadEconomicModel() {
  try {
    const response = await fetch("/economic-model.json", { cache: "no-store" });
    if (!response.ok) return;
    const model = await response.json();
    if (!Array.isArray(model.layers) || model.layers.length !== 2 || !model.normalization) return;
    const normalized = model.observed
      ? [model.observed.inflation, model.observed.gdpGrowth, model.observed.unemployment].map((value, i) =>
        (value - model.normalization.inputMean[i]) / model.normalization.inputStd[i])
      : null;
    if (!normalized || normalized.some((value) => !Number.isFinite(value))) return;
    const [hiddenLayer, outputLayer] = model.layers;
    const hidden = hiddenLayer.bias.map((bias, unit) => Math.max(0,
      normalized.reduce((sum, value, input) => sum + value * hiddenLayer.kernel[input][unit], bias)));
    const predicted = hidden.reduce((sum, value, unit) => sum + value * outputLayer.kernel[unit][0], outputLayer.bias[0])
      * model.normalization.outputStd + model.normalization.outputMean;
    if (!Number.isFinite(predicted)) return;
    document.querySelector("#economy-data > div:first-child strong").textContent = `${predicted.toFixed(1)}%`;
    document.querySelector("#economy-data > div:first-child span").textContent = `${model.forecastYear} model estimate`;
    document.querySelector("#economy-data > div:nth-child(2) strong").textContent = `${model.observed.gdpGrowth.toFixed(1)}%`;
    document.querySelector("#economy-data > div:nth-child(2) span").textContent = "Latest GDP growth";
    document.querySelector("#model-copy").textContent = `Experimental US CPI estimate trained on World Bank data through ${model.trainedThrough}.`;
    document.querySelector("#model-status").textContent = "Experimental model estimate · World Bank data. Not financial advice.";
  } catch (error) {
    console.error("Economic model could not be loaded:", error);
  }
}

renderTransactions();
document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(new Date()).toUpperCase();
try {
  const profile = JSON.parse(localStorage.getItem("ai-money-profile") || "null");
  applyProfile(profile);
} catch (error) {
  console.error("Saved demo profile could not be read:", error);
}
loadEconomicModel();
