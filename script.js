document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const priorCheckbox = document.getElementById('informativePrior');
    const calculateButton = document.getElementById('calculate');
    const informativeInputs = document.querySelectorAll('#informative-prior-inputs input');
    const singleEstimateInput = document.getElementById('single_estimate');
    const lowerBoundInput = document.getElementById('lower_bound');
    const upperBoundInput = document.getElementById('upper_bound');
    const statsDiv = document.getElementById("stats");

    // Validation Constants
    const MIN_VALUE = 0;

    // Initialize
    setupEventListeners();
    validateInputs();

    function setupEventListeners() {
        if (priorCheckbox) {
            priorCheckbox.addEventListener('change', handlePriorCheckboxChange);
        }
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', validateInputs);
        });
        calculateButton.addEventListener('click', handleCalculate);
    }

    function handlePriorCheckboxChange() {
        informativeInputs.forEach(input => {
            input.disabled = !priorCheckbox.checked;
            if (!priorCheckbox.checked) {
                input.value = '1';
                clearError(input);
            }
        });
        validateInputs();
    }

    function validateInputs() {
        const singleEstimate = parseFloat(singleEstimateInput.value);
        const lowerBound = parseFloat(lowerBoundInput.value);
        const upperBound = parseFloat(upperBoundInput.value);

        if (isNaN(singleEstimate) || isNaN(lowerBound) || isNaN(upperBound)) {
            alert("Please enter valid numbers for all inputs.");
            return false;
        }

        if (singleEstimate < 0 || singleEstimate > 1 || lowerBound < 0 || lowerBound > 1 || upperBound < 0 || upperBound > 1) {
            alert("Values must be between 0 and 1.");
            return false;
        }

        if (lowerBound >= upperBound) {
            alert("Lower bound must be less than upper bound.");
            return false;
        }

        return true;
    }

    function handleCalculate() {
        if (!validateInputs()) return;

        const singleEstimate = parseFloat(singleEstimateInput.value);
        const lowerBound = parseFloat(lowerBoundInput.value);
        const upperBound = parseFloat(upperBoundInput.value);

        // Calculate alpha and beta parameters based on the inputs
        const variance = Math.pow((upperBound - lowerBound) / 4, 2); // Using quarter range as approx standard deviation
        const mean = singleEstimate;
        
        // Method of moments estimation
        const nu = ((mean * (1 - mean)) / variance) - 1;
        const alpha = mean * nu;
        const beta = (1 - mean) * nu;

        // Ensure parameters are valid
        if (alpha < 0.1 || beta < 0.1) {
            alert("The specified bounds suggest too much uncertainty. Please adjust your estimates.");
            return;
        }

        // Calculate mode
        let mode;
        if (alpha > 1 && beta > 1) {
            mode = (alpha - 1) / (alpha + beta - 2);
        } else {
            mode = "undefined";
        }

        // Calculate additional statistics
        const totalEquivalentSamples = Math.round(alpha + beta);
        const equivalentSuccesses = Math.round(alpha);
        
        // Calculate percentiles
        const percentiles = [0.05, 0.25, 0.50, 0.75, 0.95].map(p => ({
            percentile: p,
            value: jStat.beta.inv(p, alpha, beta)
        }));

        // Display results
        statsDiv.innerHTML = `
            <h3>Parameters</h3>
            <p>Alpha (α): ${alpha.toFixed(2)}</p>
            <p>Beta (β): ${beta.toFixed(2)}</p>
            <p>Mean: ${mean.toFixed(3)}</p>
            <p>Mode: ${typeof mode === 'number' ? mode.toFixed(3) : mode}</p>

            <h3>Percentiles</h3>
            <table>
                <tr>
                    <th>Percentile</th>
                    <th>Value</th>
                </tr>
                ${percentiles.map(p => `
                    <tr>
                        <td>${(p.percentile * 100).toFixed(0)}%</td>
                        <td>${p.value.toFixed(3)}</td>
                    </tr>
                `).join('')}
            </table>

            <h3>Equivalent Data Collection</h3>
            <p>This distribution is equivalent to having observed ${equivalentSuccesses} successes 
            in ${totalEquivalentSamples} trials.</p>
        `;

        // Plot the Beta distribution
        plotBetaDistribution(alpha, beta);

        // Call displayResults to generate and display the verbal explanation
        displayResults({ alpha, beta });
    }

    function plotBetaDistribution(alpha, beta) {
        const x = [];
        const y = [];
        for (let i = 0; i <= 1; i += 0.01) {
            x.push(i);
            y.push(jStat.beta.pdf(i, alpha, beta));
        }

        const trace = {
            x: x,
            y: y,
            type: 'scatter',
            mode: 'lines',
            showlegend: false  // Remove legend
        };

        const layout = {
            xaxis: { title: 'Proportion' },
            yaxis: { title: 'Density' },
            margin: { t: 10, r: 10, b: 50, l: 60 },  // Adjust margins
            responsive: true  // Ensure the plot resizes adaptively
        };

        Plotly.newPlot('chart', [trace], layout);
    }

    function displayResults(data) {
        // Plot the distribution
        const trace = {
            x: [...Array(100).keys()].map(x => x / 100),
            y: [...Array(100).keys()].map(x => jStat.beta.pdf(x / 100, data.alpha, data.beta)),
            type: 'scatter'
        };

        const layout = {
            xaxis: { title: 'Proportion' },
            yaxis: { title: 'Density' },
            responsive: true  // Ensure the plot resizes adaptively
        };

        Plotly.newPlot('chart', [trace], layout);

        // Calculate statistics
        const mean = data.alpha / (data.alpha + data.beta);
        const percentiles = [0.05, 0.25, 0.5, 0.75, 0.95].map(p => ({
            percentile: p * 100,
            value: jStat.beta.inv(p, data.alpha, data.beta)
        }));
        const totalEquivalentSamples = Math.round(data.alpha + data.beta);
        const equivalentSuccesses = Math.round(data.alpha);

        // Generate verbal explanation
        const statsHtml = `
            <h4>Distribution Parameters</h4>
            <p>This Beta distribution has parameters α = ${data.alpha.toFixed(2)} and β = ${data.beta.toFixed(2)}.</p>
            
            <h4>Expected Value and Uncertainty</h4>
            <p>Based on your inputs, the expected value (mean) is ${mean.toFixed(3)}. This represents your best single estimate of the true proportion.</p>
            
            <h4>Probability Ranges</h4>
            <p>Given this distribution:</p>
            <table>
                <tr>
                    <th>Interpretation</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Very unlikely to be below (5th percentile)</td>
                    <td>${percentiles[0].value.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Likely range (25th to 75th percentile)</td>
                    <td>${percentiles[1].value.toFixed(2)} to ${percentiles[3].value.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Very unlikely to be above (95th percentile)</td>
                    <td>${percentiles[4].value.toFixed(2)}</td>
                </tr>
            </table>

            <h4>Equivalent Data Interpretation</h4>
            <p>This distribution assumes the same level of knowledge you would have if you had conducted a study with ${totalEquivalentSamples} observations and observed ${equivalentSuccesses} successes.</p>
            
            <h4>What This Means</h4>
            <p>You can use these parameters (α = ${data.alpha.toFixed(2)}, β = ${data.beta.toFixed(2)}) as your prior in a Bayesian analysis. When you collect new data, combine it with these parameters to update your knowledge about the true proportion.</p>
        `;

        document.getElementById('stats').innerHTML = statsHtml;
    }

    function setError(element, message) {
        const errorId = `error_${element.id}`;
        const errorElement = document.getElementById(errorId) || 
            createErrorElement(element, errorId);
        errorElement.textContent = message;
        element.classList.add('input-error');
    }

    function clearError(element) {
        const errorId = `error_${element.id}`;
        const errorElement = document.getElementById(errorId);
        if (errorElement) errorElement.textContent = '';
        element.classList.remove('input-error');
    }

    function clearAllErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        document.querySelectorAll('.input-error').forEach(el => 
            el.classList.remove('input-error'));
    }

    function createErrorElement(input, errorId) {
        const errorDiv = document.createElement('div');
        errorDiv.id = errorId;
        errorDiv.className = 'error-message';
        input.parentNode.appendChild(errorDiv);
        return errorDiv;
    }
});