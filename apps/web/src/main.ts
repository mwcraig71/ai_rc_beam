import { designBeam, DesignRequest } from '@rc-beam/core';

// Unit labels
const UNIT_LABELS = {
  US: {
    length: 'in',
    span: 'ft',
    load: 'lb/ft',
    moment: 'kip-ft',
    shear: 'kip',
    fc: 'psi',
    fy: 'psi',
    area: 'in²'
  },
  SI: {
    length: 'mm',
    span: 'm',
    load: 'kN/m',
    moment: 'kN-m',
    shear: 'kN',
    fc: 'MPa',
    fy: 'MPa',
    area: 'mm²'
  }
};

// Update unit labels in UI
function updateUnitLabels(units: 'US' | 'SI') {
  const labels = UNIT_LABELS[units];
  
  document.querySelectorAll('.unit-fc').forEach(el => el.textContent = `(${labels.fc})`);
  document.querySelectorAll('.unit-fy').forEach(el => el.textContent = `(${labels.fy})`);
  document.querySelectorAll('.unit-length').forEach(el => el.textContent = `(${labels.length})`);
  document.querySelectorAll('.unit-load').forEach(el => el.textContent = `(${labels.load})`);
  document.querySelectorAll('.unit-moment').forEach(el => el.textContent = `(${labels.moment})`);
  document.querySelectorAll('.unit-shear').forEach(el => el.textContent = `(${labels.shear})`);
  
  // Update input values for SI
  if (units === 'SI') {
    (document.getElementById('fc') as HTMLInputElement).value = '28';
    (document.getElementById('fy') as HTMLInputElement).value = '420';
    (document.getElementById('span') as HTMLInputElement).value = '6';
    (document.getElementById('deadLoad') as HTMLInputElement).value = '15';
    (document.getElementById('liveLoad') as HTMLInputElement).value = '25';
    (document.getElementById('cover') as HTMLInputElement).value = '40';
  } else {
    (document.getElementById('fc') as HTMLInputElement).value = '4000';
    (document.getElementById('fy') as HTMLInputElement).value = '60000';
    (document.getElementById('span') as HTMLInputElement).value = '20';
    (document.getElementById('deadLoad') as HTMLInputElement).value = '1000';
    (document.getElementById('liveLoad') as HTMLInputElement).value = '2000';
    (document.getElementById('cover') as HTMLInputElement).value = '1.5';
  }
}

// Toggle load inputs
function toggleLoadInputs() {
  const loadType = (document.getElementById('loadType') as HTMLSelectElement).value;
  const simpleSpan = document.getElementById('simpleSpanInputs')!;
  const direct = document.getElementById('directInputs')!;
  
  if (loadType === 'simple_span') {
    simpleSpan.classList.remove('hidden');
    direct.classList.add('hidden');
  } else {
    simpleSpan.classList.add('hidden');
    direct.classList.remove('hidden');
  }
}

// Perform design
function performDesign() {
  const units = (document.getElementById('units') as HTMLSelectElement).value as 'US' | 'SI';
  const fc = parseFloat((document.getElementById('fc') as HTMLInputElement).value);
  const fy = parseFloat((document.getElementById('fy') as HTMLInputElement).value);
  const loadType = (document.getElementById('loadType') as HTMLSelectElement).value;
  const objective = (document.getElementById('objective') as HTMLSelectElement).value as 'minimize_steel' | 'minimize_depth';
  const cover = parseFloat((document.getElementById('cover') as HTMLInputElement).value);
  
  const request: DesignRequest = {
    units,
    fc,
    fy,
    loading: loadType === 'simple_span' ? {
      mode: 'simple_span',
      span_length: parseFloat((document.getElementById('span') as HTMLInputElement).value),
      dead_load: parseFloat((document.getElementById('deadLoad') as HTMLInputElement).value),
      live_load: parseFloat((document.getElementById('liveLoad') as HTMLInputElement).value)
    } : {
      mode: 'direct',
      Mu: parseFloat((document.getElementById('mu') as HTMLInputElement).value),
      Vu: parseFloat((document.getElementById('vu') as HTMLInputElement).value)
    },
    objective,
    constraints: {
      cover
    },
    bar_preferences: {}
  };
  
  try {
    const result = designBeam(request);
    displayResults(result, units);
  } catch (error) {
    displayError((error as Error).message);
  }
}

// Display results
function displayResults(result: any, units: 'US' | 'SI') {
  const labels = UNIT_LABELS[units];
  
  // Hide error, show results
  document.getElementById('error')!.classList.add('hidden');
  document.getElementById('results')!.classList.remove('hidden');
  
  // Section size
  document.getElementById('sectionSize')!.textContent = 
    `${result.section.b.toFixed(1)} × ${result.section.h.toFixed(1)} ${labels.length}`;
  
  // Tension steel
  const asText = result.As.toFixed(2);
  const compressionText = result.As_prime ? ` + ${result.As_prime.toFixed(2)} (comp)` : '';
  document.getElementById('tensionSteel')!.textContent = `${asText}${compressionText} ${labels.area}`;
  
  // Rho
  document.getElementById('rho')!.textContent = result.rho.toFixed(4);
  
  // Capacity
  const ratio = (result.phi_Mn / result.Mu).toFixed(2);
  document.getElementById('capacity')!.textContent = `${ratio}x`;
  
  // Checks
  const checksContainer = document.getElementById('checks')!;
  checksContainer.innerHTML = '<h3>Design Checks</h3>';
  
  result.checks.forEach((check: any) => {
    const div = document.createElement('div');
    div.className = `check-item ${check.passed ? 'passed' : 'failed'}`;
    div.textContent = `${check.passed ? '✓' : '✗'} ${check.message}`;
    checksContainer.appendChild(div);
  });
  
  // Warnings
  const warningsContainer = document.getElementById('warnings')!;
  warningsContainer.innerHTML = '';
  
  if (result.warnings.length > 0) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'warning';
    warningDiv.innerHTML = '<strong>⚠️ Warnings:</strong><br>' + 
      result.warnings.map((w: string) => `• ${w}`).join('<br>');
    warningsContainer.appendChild(warningDiv);
  }
  
  // Rationale
  document.getElementById('rationale')!.textContent = result.rationale;
}

// Display error
function displayError(message: string) {
  document.getElementById('results')!.classList.add('hidden');
  const errorDiv = document.getElementById('error')!;
  errorDiv.textContent = `Error: ${message}`;
  errorDiv.classList.remove('hidden');
}

// Event listeners
document.getElementById('units')!.addEventListener('change', (e) => {
  updateUnitLabels((e.target as HTMLSelectElement).value as 'US' | 'SI');
});

document.getElementById('loadType')!.addEventListener('change', toggleLoadInputs);

document.getElementById('designBtn')!.addEventListener('click', performDesign);

// Initialize
updateUnitLabels('US');
toggleLoadInputs();
