document.addEventListener("DOMContentLoaded", function () {

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getThemeColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function colors() {
    return {
      accent: getThemeColor("--accent-blue") || "#2563eb",
      fill: getThemeColor("--accent-blue-fill") || "rgba(37,99,235,0.12)",
      fillStrong: getThemeColor("--accent-blue-fill-strong") || "rgba(37,99,235,0.35)",
      textFade: getThemeColor("--text-fade") || "#64748b",
      border: getThemeColor("--border") || "#e2e8f0",
    };
  }

  const $ = (id) => document.getElementById(id);

  // ── Error handling ────────────────────────────────────────────────────────

  function setError(id, msg) {
    const el = $(id);
    if (el) el.textContent = msg;
  }

  function clearErrors() {
    document.querySelectorAll(".error-message").forEach((el) => (el.textContent = ""));
  }

  // ── Validation & reading inputs ───────────────────────────────────────────

  function validateAndRead() {
    clearErrors();
    let valid = true;

    const singleEstimate = parseFloat($("single_estimate").value);
    const lowerBound = parseFloat($("lower_bound").value);
    const upperBound = parseFloat($("upper_bound").value);

    if (isNaN(singleEstimate)) {
      setError("error_single_estimate", "Enter a number between 0 and 1.");
      valid = false;
    } else if (singleEstimate < 0 || singleEstimate > 1) {
      setError("error_single_estimate", "Must be between 0 and 1.");
      valid = false;
    }

    if (isNaN(lowerBound)) {
      setError("error_lower_bound", "Enter a number between 0 and 1.");
      valid = false;
    } else if (lowerBound < 0 || lowerBound > 1) {
      setError("error_lower_bound", "Must be between 0 and 1.");
      valid = false;
    }

    if (isNaN(upperBound)) {
      setError("error_upper_bound", "Enter a number between 0 and 1.");
      valid = false;
    } else if (upperBound < 0 || upperBound > 1) {
      setError("error_upper_bound", "Must be between 0 and 1.");
      valid = false;
    }

    if (valid && lowerBound >= upperBound) {
      setError("error_lower_bound", "Lower bound must be less than the upper bound.");
      valid = false;
    }

    if (valid && (singleEstimate < lowerBound || singleEstimate > upperBound)) {
      setError("error_single_estimate", "Single estimate must be within the lower and upper bounds.");
      valid = false;
    }

    if (!valid) return null;
    return { singleEstimate, lowerBound, upperBound };
  }

  // ── Method-of-moments computation ────────────────────────────────────────
  // Preserved from original: variance = ((upper - lower) / 4)^2, mean = estimate.

  function computeParams(singleEstimate, lowerBound, upperBound) {
    const mean = singleEstimate;
    const variance = Math.pow((upperBound - lowerBound) / 4, 2);
    const nu = (mean * (1 - mean)) / variance - 1;
    const alpha = mean * nu;
    const beta = (1 - mean) * nu;
    return { alpha, beta, mean };
  }

  // ── Chart rendering ───────────────────────────────────────────────────────

  function renderChart(alpha, beta) {
    const c = colors();
    const N = 501;
    const x = Array.from({ length: N }, (_, i) => i / (N - 1));
    const y = x.map((v) => jStat.beta.pdf(v, alpha, beta));

    // Central 90% shaded region (5th–95th percentile)
    const q05 = jStat.beta.inv(0.05, alpha, beta);
    const q95 = jStat.beta.inv(0.95, alpha, beta);

    const xShade = [];
    const yShade = [];
    for (let i = 0; i < N; i++) {
      if (x[i] >= q05 && x[i] <= q95) {
        xShade.push(x[i]);
        yShade.push(y[i]);
      }
    }
    // Close the fill region at the boundary points
    if (xShade.length > 0) {
      xShade.unshift(q05);
      yShade.unshift(jStat.beta.pdf(q05, alpha, beta));
      xShade.push(q95);
      yShade.push(jStat.beta.pdf(q95, alpha, beta));
    }

    const traces = [
      {
        x,
        y,
        mode: "lines",
        line: { color: c.accent, width: 2.5 },
        fill: "none",
        hoverinfo: "skip",
        showlegend: false,
      },
      {
        x: xShade,
        y: yShade,
        mode: "lines",
        line: { color: c.accent, width: 0 },
        fill: "tozeroy",
        fillcolor: c.fillStrong,
        hoverinfo: "skip",
        showlegend: false,
      },
    ];

    Plotly.newPlot(
      "chart",
      traces,
      {
        margin: { l: 46, r: 16, t: 10, b: 46 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        xaxis: {
          title: "Proportion",
          range: [0, 1],
          tickformat: ".0%",
          color: c.textFade,
          gridcolor: c.border,
          zerolinecolor: c.border,
        },
        yaxis: {
          title: "Density",
          rangemode: "tozero",
          color: c.textFade,
          gridcolor: c.border,
          zerolinecolor: c.border,
        },
      },
      { displayModeBar: false, responsive: true }
    );
  }

  // ── Stats panel rendering ─────────────────────────────────────────────────

  function renderStats(alpha, beta, mean) {
    let mode;
    if (alpha > 1 && beta > 1) {
      mode = ((alpha - 1) / (alpha + beta - 2)).toFixed(3);
    } else {
      mode = "undefined (distribution is not unimodal)";
    }

    const totalEquivalentSamples = Math.round(alpha + beta);
    const equivalentSuccesses = Math.round(alpha);

    const percentileRows = [0.05, 0.25, 0.50, 0.75, 0.95]
      .map((p) => {
        const val = jStat.beta.inv(p, alpha, beta).toFixed(3);
        return `<tr><td>${(p * 100).toFixed(0)}th</td><td>${val}</td></tr>`;
      })
      .join("");

    $("stats").innerHTML = `
      <h4>Parameters</h4>
      <p>Alpha (α): <strong>${alpha.toFixed(2)}</strong> &nbsp;&nbsp; Beta (β): <strong>${beta.toFixed(2)}</strong></p>
      <p>Mean: <strong>${mean.toFixed(3)}</strong> &nbsp;&nbsp; Mode: <strong>${mode}</strong></p>

      <h4>Percentiles</h4>
      <table>
        <thead>
          <tr><th>Percentile</th><th>Value</th></tr>
        </thead>
        <tbody>
          ${percentileRows}
        </tbody>
      </table>

      <h4>Equivalent data</h4>
      <div class="equivalent-callout">
        Using this prior is equivalent to having already observed <strong>${equivalentSuccesses} successes in ${totalEquivalentSamples} trials</strong>. When you collect new data, add your observed successes to α and your observed failures to β to get the posterior.
      </div>

      <h4>How to use these parameters</h4>
      <p>Enter <strong>α = ${alpha.toFixed(2)}</strong> and <strong>β = ${beta.toFixed(2)}</strong> as your prior in the <a href="https://alecscharff.github.io/bayes-ux-calculator/" class="elegant-link" target="_blank" rel="noopener">Bayesian UX calculator</a>.</p>
    `;
  }

  // ── Main recompute ────────────────────────────────────────────────────────

  function recompute() {
    const inputs = validateAndRead();
    if (!inputs) return;

    const { singleEstimate, lowerBound, upperBound } = inputs;
    const { alpha, beta, mean } = computeParams(singleEstimate, lowerBound, upperBound);

    if (alpha < 0.1 || beta < 0.1) {
      setError(
        "error_global",
        "The specified bounds suggest too much uncertainty. Try a narrower range."
      );
      return;
    }

    renderChart(alpha, beta);
    renderStats(alpha, beta, mean);
  }

  // ── Debounced input binding ───────────────────────────────────────────────

  let debounceTimer = null;
  function debouncedRecompute() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(recompute, 150);
  }

  document.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener("input", debouncedRecompute);
  });

  // ── Theme toggle ──────────────────────────────────────────────────────────

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
  }

  const savedTheme = (() => {
    try {
      return localStorage.getItem("theme");
    } catch (e) {
      return null;
    }
  })();

  if (savedTheme === "dark" || savedTheme === "light") {
    applyTheme(savedTheme);
  } else {
    const prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  $("theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
    // Re-render chart so Plotly picks up the new CSS color vars
    recompute();
  });

  // ── Initial render ────────────────────────────────────────────────────────

  recompute();
});
