import json
import urllib.request
from pathlib import Path

import numpy as np
import tensorflow as tf


ROOT = Path(__file__).parent
OUTPUT = ROOT / "economic-model.json"
COUNTRY = "USA"
INDICATORS = {
    "inflation": "FP.CPI.TOTL.ZG",
    "gdp_growth": "NY.GDP.MKTP.KD.ZG",
    "unemployment": "SL.UEM.TOTL.ZS",
}


def fetch_indicator(code):
    url = f"https://api.worldbank.org/v2/country/{COUNTRY}/indicator/{code}?format=json&per_page=100"
    request = urllib.request.Request(url, headers={"User-Agent": "AI-Money-Prototype/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        result = json.load(response)
    if len(result) < 2 or not result[1]:
        raise RuntimeError(f"No World Bank observations returned for {code}.")
    return {
        int(row["date"]): float(row["value"])
        for row in result[1]
        if row.get("value") is not None
    }


def main():
    observations = {name: fetch_indicator(code) for name, code in INDICATORS.items()}
    years = sorted(set.intersection(*(set(values) for values in observations.values())))
    rows = [
        [observations["inflation"][year], observations["gdp_growth"][year], observations["unemployment"][year]]
        for year in years
    ]
    samples = [
        (rows[index], observations["inflation"][year + 1])
        for index, year in enumerate(years)
        if year + 1 in observations["inflation"]
        and year + 1 in observations["gdp_growth"]
        and year + 1 in observations["unemployment"]
    ]
    if len(samples) < 12:
        raise RuntimeError("Not enough overlapping annual observations to train the model.")

    x = np.asarray([sample[0] for sample in samples], dtype=np.float32)
    y = np.asarray([sample[1] for sample in samples], dtype=np.float32).reshape(-1, 1)
    x_mean, x_std = x.mean(axis=0), x.std(axis=0)
    x_std[x_std == 0] = 1
    y_mean, y_std = float(y.mean()), float(y.std()) or 1.0
    x_scaled = (x - x_mean) / x_std
    y_scaled = (y - y_mean) / y_std

    tf.keras.utils.set_random_seed(17)
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(3,)),
        tf.keras.layers.Dense(8, activation="relu"),
        tf.keras.layers.Dense(1),
    ])
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.01), loss="mse")
    model.fit(x_scaled, y_scaled, epochs=240, verbose=0, shuffle=False)

    weights = []
    for layer in model.layers:
        kernel, bias = layer.get_weights()
        weights.append({"kernel": kernel.tolist(), "bias": bias.tolist(), "activation": layer.activation.__name__})

    latest = years[-1]
    latest_features = [
        observations["inflation"][latest],
        observations["gdp_growth"][latest],
        observations["unemployment"][latest],
    ]
    forecast = float(model.predict((np.asarray([latest_features]) - x_mean) / x_std, verbose=0)[0][0] * y_std + y_mean)
    payload = {
        "country": COUNTRY,
        "countryName": "United States",
        "trainedThrough": latest,
        "forecastYear": latest + 1,
        "observed": {
            "inflation": latest_features[0],
            "gdpGrowth": latest_features[1],
            "unemployment": latest_features[2],
        },
        "forecastInflation": forecast,
        "normalization": {
            "inputMean": x_mean.tolist(),
            "inputStd": x_std.tolist(),
            "outputMean": y_mean,
            "outputStd": y_std,
        },
        "layers": weights,
        "trainingSamples": len(samples),
        "source": "World Bank Open Data API",
        "warning": "Experimental educational forecast; not financial advice.",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Trained on {len(samples)} annual observations; exported {OUTPUT.relative_to(ROOT)}.")
    print(f"Estimated {payload['forecastYear']} inflation: {forecast:.2f}% (experimental).")


if __name__ == "__main__":
    main()
