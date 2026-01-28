/**
 * Montelukast Risk Assessment Engine & Controller
 * Combined Logic
 */

const RiskEngine = {
    // 1. Age-based Baseline Risk (Using average of ranges)
    AGE_BASELINES: {
        '16-18': 0.14,  // 10-18%
        '13-15': 0.325, // 20-45%
        '10-12': 0.535, // 47-60%
        '7-9': 0.69,  // 60-78%
        '4-6': 0.85,  // 79-91%
        '1-3': 0.94   // 92-96%
    },

    // 2. Dose Scaling 
    DOSE_MULTIPLIERS: {
        '4mg': 1.0,
        '5mg': 1.1,
        '10mg': 1.25
    },

    // 3. Duration Scaling
    DURATION_MULTIPLIERS: {
        'short': 1.0,   // < 1 month
        'medium': 1.1,  // 1-6 months
        'long': 1.2     // > 6 months
    },

    // 4. Symptoms Database
    SYMPTOMS: {
        HIGH_RISK: [
            "Suicidal ideation / self-harm thoughts",
            "Suicide attempt",
            "Severe depression",
            "Psychosis / hallucinations",
            "Severe aggression or violent behavior",
            "Extreme mood swings",
            "Severe anxiety with panic attacks",
            "Personality changes (sudden, marked)",
            "Disorientation / confusion",
            "Loss of reality contact",
            "Behavioral regression (in children)"
        ],
        MODERATE_LOW_RISK: [
            "Anxiety",
            "Depression (mild-moderate)",
            "Irritability",
            "Aggressive behavior", // Moderate version
            "Emotional lability",
            "Night terrors",
            "Severe insomnia",
            "Social withdrawal",
            "Poor concentration / attention issues",
            "Sleep disturbance",
            "Restlessness",
            "Nightmares",
            "Crying spells",
            "Fatigue",
            "Headache with mood change",
            "Appetite changes",
            "Mild mood changes"
        ]
    },

    // Helper: Map Age Number to Range Key
    getAgeGroupKey: function (age) {
        if (!age) return '7-9'; // Default
        if (age >= 16) return '16-18';
        if (age >= 13) return '13-15';
        if (age >= 10) return '10-12';
        if (age >= 7) return '7-9';
        if (age >= 4) return '4-6';
        return '1-3';
    },

    // Helper: Map Months to Duration Key
    getDurationKey: function (months) {
        if (months === '' || months === null) return 'medium';
        if (months < 1) return 'short';
        if (months <= 6) return 'medium';
        return 'long';
    },

    /**
     * Calculate absolute risk percentage.
     */
    calculate: function (ageInput, dose, durationInput, selectedSymptoms, temporalAssociation) {
        const ageGroup = this.getAgeGroupKey(ageInput);
        const duration = this.getDurationKey(durationInput);

        // 1. Establish Baseline
        let baseRisk = this.AGE_BASELINES[ageGroup] || 0.14;

        // 2. Apply Dose & Duration
        const doseMult = this.DOSE_MULTIPLIERS[dose] || 1.0;
        const durMult = this.DURATION_MULTIPLIERS[duration] || 1.0;

        // Intermediate Risk Calculation (Before Symptoms)
        let currentRisk = baseRisk * doseMult * durMult;

        // 3. Symptom Logic
        const symptomCount = selectedSymptoms.length;
        let symptomRiskCategory = "Low";
        let symptomAdder = 0;

        // Count Rule
        if (symptomCount >= 4) {
            symptomRiskCategory = "High";
            symptomAdder = 0.25;
        } else if (symptomCount >= 2) {
            symptomRiskCategory = "Moderate";
            symptomAdder = 0.10;
        } else if (symptomCount === 1) {
            symptomRiskCategory = "Low";
            symptomAdder = 0.05;
        }

        currentRisk += symptomAdder;

        // 4. Severity Boost
        const hasHighSeverity = selectedSymptoms.some(s => this.SYMPTOMS.HIGH_RISK.includes(s));

        if (hasHighSeverity) {
            currentRisk = Math.max(currentRisk, 0.75);
            symptomRiskCategory = "High (Severity)";
        }

        // 5. Temporal Relation Rule
        if (temporalAssociation) {
            currentRisk *= 1.15; // +15% boost
        }

        // 6. Clamping
        if (currentRisk > 0.99) currentRisk = 0.99;
        if (currentRisk < 0.05) currentRisk = 0.05;

        // 7. Determine Final Label
        let finalLabel = "Low Risk";
        if (currentRisk >= 0.70) finalLabel = "High Risk";
        else if (currentRisk >= 0.30) finalLabel = "Moderate Risk";

        return {
            percentage: Math.round(currentRisk * 100),
            label: finalLabel,
            details: {
                base: baseRisk,
                symptomCat: symptomRiskCategory,
                hasHighSeverity: hasHighSeverity
            }
        };
    }
};

/**
 * Controller
 */
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const els = {
        ageInput: document.getElementById('ageInput'),
        doseInputs: document.getElementsByName('dose'),
        durationInput: document.getElementById('durationInput'),
        temporalSelect: document.getElementById('temporalSelect'),
        symptomsList: document.getElementById('symptomsList'),
        riskScore: document.getElementById('riskScore'),
        riskCircle: document.getElementById('riskCircle'),
        riskLabel: document.getElementById('riskLabel'),
        riskExplanation: document.getElementById('riskExplanation'),
        summaryCount: document.getElementById('summaryCount'),
        summarySeverity: document.getElementById('summarySeverity')
    };

    // State
    const state = {
        age: 8,
        dose: '5mg',
        durationMonths: 3,
        symptoms: [],
        temporal: true
    };

    // Initialize Symptom List
    function renderSymptoms() {
        const highRisk = RiskEngine.SYMPTOMS.HIGH_RISK;
        const medRisk = RiskEngine.SYMPTOMS.MODERATE_LOW_RISK;

        const allSymptoms = [
            ...highRisk.map(s => ({ name: s, type: 'high' })),
            ...medRisk.map(s => ({ name: s, type: 'mod' }))
        ].sort((a, b) => a.name.localeCompare(b.name));

        els.symptomsList.innerHTML = allSymptoms.map((sym, index) => `
            <div class="symptom-item ${sym.type === 'high' ? 'high-risk' : ''}">
                <input type="checkbox" id="sym_${index}" value="${sym.name}" data-severity="${sym.type}">
                <label for="sym_${index}">
                    ${sym.name}
                    ${sym.type === 'high' ? '<span style="margin-left:auto; color:#ef4444; font-size:1.2em;">⚠</span>' : ''}
                </label>
            </div>
        `).join('');

        els.symptomsList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', updateState);
        });
    }

    // Update State from DOM
    function updateState() {
        state.age = parseFloat(els.ageInput.value) || 0;
        state.durationMonths = parseFloat(els.durationInput.value);
        if (isNaN(state.durationMonths)) state.durationMonths = 0;

        // Radio buttons for dose
        els.doseInputs.forEach(radio => {
            if (radio.checked) state.dose = radio.value;
        });

        // Temporal
        state.temporal = els.temporalSelect.value === 'yes';

        // Collect Checked Symptoms
        state.symptoms = Array.from(els.symptomsList.querySelectorAll('input:checked')).map(cb => cb.value);

        calculateAndRender();
    }

    // Calculate Risk and Update UI
    function calculateAndRender() {
        const result = RiskEngine.calculate(
            state.age,
            state.dose,
            state.durationMonths,
            state.symptoms,
            state.temporal
        );

        // Animate Counter
        animateValue(els.riskScore, parseInt(els.riskScore.textContent), result.percentage, 500);

        // Update Circle
        const circumference = 628;
        const offset = circumference - ((result.percentage / 100) * circumference);
        els.riskCircle.style.strokeDashoffset = offset;

        // Update Color
        let colorVar = '--risk-low';
        let bgClass = 'bg-low';

        if (result.label.includes('High')) {
            colorVar = '--risk-high';
            bgClass = 'bg-high';
        } else if (result.label.includes('Moderate')) {
            colorVar = '--risk-mod';
            bgClass = 'bg-mod';
        }

        const colorHex = getComputedStyle(document.body).getPropertyValue(colorVar).trim();
        els.riskCircle.style.stroke = colorHex;

        // Update Label
        els.riskLabel.className = `risk-label ${bgClass}`;
        els.riskLabel.textContent = result.label;

        // Update Explanation
        els.riskExplanation.innerHTML = `
            <strong>${result.percentage}% Probability</strong><br>
            Base Risk (Age): ${Math.round(result.details.base * 100)}%<br>
            ${result.details.symptomCat === 'High (Severity)' ? '<span style="color:var(--risk-high)">High Severity Symptom Detected</span>' : `Symptom Load: ${result.details.symptomCat}`}
        `;

        // Summary Inputs
        els.summaryCount.textContent = state.symptoms.length;
        els.summarySeverity.textContent = result.details.hasHighSeverity ? "High" : "Low/Mod";
        els.summarySeverity.className = result.details.hasHighSeverity ? "status-high" : "status-low";
    }

    // Number Animation Helper
    function animateValue(obj, start, end, duration) {
        if (start === end) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // Event Listeners for Inputs
    els.ageInput.addEventListener('input', updateState);
    els.durationInput.addEventListener('input', updateState);
    els.temporalSelect.addEventListener('change', updateState);
    els.doseInputs.forEach(input => input.addEventListener('change', updateState));

    // Initial Run
    renderSymptoms();
    updateState();
});
