import {
  DesignRequest,
  DesignResponse,
  ObjectiveMode,
  CheckResult,
  BarLayout
} from './types.js';
import {
  calculateSimpleSpanMoment,
  calculateSimpleSpanShear,
  calculateMinRho,
  calculateMaxRhoSingly,
  solveRectangularSection,
  calculatePhi,
  getLimitState,
  calculateShearCapacity
} from './calculations.js';
import { getDefaultConstraints, getBeta1 } from './constants.js';
import { findBarLayout, calculateEffectiveDepth, formatBarLayout } from './bar-layout.js';

/**
 * Main beam design function
 */
export function designBeam(request: DesignRequest): DesignResponse {
  try {
    // Parse and validate input
    const req = request;
    const units = req.units;
    
    // Calculate factored loads
    let Mu: number, Vu: number;
    if (req.loading.mode === 'simple_span') {
      Mu = calculateSimpleSpanMoment(
        req.loading.span_length,
        req.loading.dead_load,
        req.loading.live_load
      );
      Vu = calculateSimpleSpanShear(
        req.loading.span_length,
        req.loading.dead_load,
        req.loading.live_load
      );
    } else {
      Mu = req.loading.Mu;
      Vu = req.loading.Vu;
    }
    
    // Get constraints
    const defaults = getDefaultConstraints(units);
    const constraints = {
      b_min: req.constraints?.b_min ?? defaults.b_min,
      b_max: req.constraints?.b_max ?? defaults.b_max,
      b_step: req.constraints?.b_step ?? defaults.b_step,
      h_min: req.constraints?.h_min ?? defaults.h_min,
      h_max: req.constraints?.h_max ?? defaults.h_max,
      cover: req.constraints?.cover ?? defaults.cover,
      max_layers: req.constraints?.max_layers ?? 2
    };
    
    // Design based on objective
    if (req.objective === 'minimize_steel') {
      return designMinimizeSteel(req, Mu, Vu, constraints);
    } else {
      return designMinimizeDepth(req, Mu, Vu, constraints);
    }
  } catch (error) {
    return {
      success: false,
      inputs: request,
      Mu: 0,
      Vu: 0,
      section: { b: 0, h: 0, d: 0, cover: 0 },
      As: 0,
      rho: 0,
      bar_layout: { tension_bars: [] },
      phi_Mn: 0,
      phi_Vn: 0,
      phi: 0,
      limit_state: 'tension_controlled',
      epsilon_t: 0,
      c: 0,
      checks: [],
      warnings: [(error as Error).message],
      rationale: `Design failed: ${(error as Error).message}`,
      code_version: 'ACI 318-19'
    };
  }
}

/**
 * Design with objective: minimize steel area
 */
function designMinimizeSteel(
  req: DesignRequest,
  Mu: number,
  Vu: number,
  constraints: any
): DesignResponse {
  const { fc, fy, units } = req;
  const { b_min, b_max, b_step, h_max, cover, max_layers } = constraints;
  
  // Set bar preferences defaults
  const minBarSize = req.bar_preferences?.min_bar_size ?? '4';
  const maxBarSize = req.bar_preferences?.max_bar_size ?? '11';
  const preferredSizes = req.bar_preferences?.preferred_sizes;
  
  // Strategy: maximize h first (reduces required As), then minimize b
  const h = h_max;
  const d_prime = cover + 0.5; // Approximate compression steel depth
  
  let bestDesign: any = null;
  
  for (let b = b_min; b <= b_max; b += b_step) {
    // Initial estimate of d
    let d = h - cover - (units === 'US' ? 0.5 : 13); // Account for bar radius
    
    // Solve for required steel
    const result = solveRectangularSection(b, d, d_prime, Mu, fc, fy, units);
    
    if (!result.converged) continue;
    
    // Find bar layout
    const tensionLayout = findBarLayout(
      result.As,
      b,
      cover,
      units,
      minBarSize,
      maxBarSize,
      max_layers,
      preferredSizes
    );
    
    if (!tensionLayout) continue;
    
    // Recalculate d with actual bars
    d = calculateEffectiveDepth(h, cover, tensionLayout.layout, units);
    
    // Re-solve with updated d
    const finalResult = solveRectangularSection(b, d, d_prime, Mu, fc, fy, units);
    if (!finalResult.converged) continue;
    
    // Check if we need compression steel
    let compressionLayout: any = null;
    let As_prime_provided = 0;
    
    if (finalResult.As_prime > 0) {
      compressionLayout = findBarLayout(
        finalResult.As_prime,
        b,
        cover,
        units,
        minBarSize,
        maxBarSize,
        1
      );
      if (!compressionLayout) continue;
      As_prime_provided = compressionLayout.As_provided;
    }
    
    const design = {
      b,
      h,
      d,
      d_prime,
      As: tensionLayout.As_provided,
      As_prime: As_prime_provided,
      c: finalResult.c,
      tensionLayout: tensionLayout.layout,
      compressionLayout: compressionLayout?.layout
    };
    
    if (!bestDesign || design.As < bestDesign.As) {
      bestDesign = design;
    }
  }
  
  if (!bestDesign) {
    throw new Error('No feasible design found within constraints');
  }
  
  return buildDesignResponse(req, Mu, Vu, bestDesign);
}

/**
 * Design with objective: minimize depth
 */
function designMinimizeDepth(
  req: DesignRequest,
  Mu: number,
  Vu: number,
  constraints: any
): DesignResponse {
  const { fc, fy, units } = req;
  const { b_min, b_max, b_step, h_min, h_max, cover, max_layers } = constraints;
  
  // Set bar preferences defaults
  const minBarSize = req.bar_preferences?.min_bar_size ?? '4';
  const maxBarSize = req.bar_preferences?.max_bar_size ?? '11';
  const preferredSizes = req.bar_preferences?.preferred_sizes;
  
  // Strategy: try increasing h until we find a feasible design
  const h_step = units === 'US' ? 2 : 50;
  
  for (let h = h_min; h <= h_max; h += h_step) {
    const d_prime = cover + (units === 'US' ? 0.5 : 13);
    
    for (let b = b_min; b <= b_max; b += b_step) {
      let d = h - cover - (units === 'US' ? 0.5 : 13);
      
      const result = solveRectangularSection(b, d, d_prime, Mu, fc, fy, units);
      if (!result.converged) continue;
      
      const tensionLayout = findBarLayout(
        result.As,
        b,
        cover,
        units,
        minBarSize,
        maxBarSize,
        max_layers,
        preferredSizes
      );
      
      if (!tensionLayout) continue;
      
      d = calculateEffectiveDepth(h, cover, tensionLayout.layout, units);
      const finalResult = solveRectangularSection(b, d, d_prime, Mu, fc, fy, units);
      if (!finalResult.converged) continue;
      
      let compressionLayout: any = null;
      let As_prime_provided = 0;
      
      if (finalResult.As_prime > 0) {
        compressionLayout = findBarLayout(
          finalResult.As_prime,
          b,
          cover,
          units,
          minBarSize,
          maxBarSize,
          1
        );
        if (!compressionLayout) continue;
        As_prime_provided = compressionLayout.As_provided;
      }
      
      const design = {
        b,
        h,
        d,
        d_prime,
        As: tensionLayout.As_provided,
        As_prime: As_prime_provided,
        c: finalResult.c,
        tensionLayout: tensionLayout.layout,
        compressionLayout: compressionLayout?.layout
      };
      
      return buildDesignResponse(req, Mu, Vu, design);
    }
  }
  
  throw new Error('No feasible design found within constraints');
}

/**
 * Build complete design response from design parameters
 */
function buildDesignResponse(
  req: DesignRequest,
  Mu: number,
  Vu: number,
  design: any
): DesignResponse {
  const { fc, fy, units } = req;
  const { b, h, d, d_prime, As, As_prime, c, tensionLayout, compressionLayout } = design;
  
  // Calculate steel ratios
  const rho = As / (b * d);
  const rho_prime = As_prime > 0 ? As_prime / (b * d) : undefined;
  
  // Calculate capacity
  const beta1 = getBeta1(fc, units);
  const a = beta1 * c;
  const epsilon_t = 0.003 * (d - c) / c;
  const phi = calculatePhi(epsilon_t);
  const limit_state = getLimitState(epsilon_t);
  
  // Moment capacity
  // Note: Mu is already in kip-ft or kN-m from the loading calculation
  // We need to calculate Mn in the same units
  let Mn = 0.85 * fc * a * b * (d - a / 2);
  
  if (As_prime > 0) {
    const Es = units === 'US' ? 29000000 : 200000;
    const epsilon_s_prime = 0.003 * (c - d_prime) / c;
    const f_s_prime = Math.min(epsilon_s_prime * Es, fy);
    Mn += As_prime * f_s_prime * (d - d_prime);
  }
  
  // Mn is in lb-in or N-mm, convert to kip-ft or kN-m
  const phi_Mn = units === 'US' ? (phi * Mn) / (1000 * 12) : (phi * Mn) / (1000 * 1000);
  
  // Shear capacity
  const phi_Vn = calculateShearCapacity(b, d, fc, units);
  
  // Perform checks
  const checks = performDesignChecks(req, { b, h, d, As, rho, phi_Mn, phi_Vn, Mu, Vu });
  
  // Build bar layout
  const barLayout: BarLayout = {
    tension_bars: tensionLayout,
    compression_bars: compressionLayout
  };
  
  // Generate rationale
  const rationale = generateRationale({
    objective: req.objective,
    b, h, d, As, As_prime, rho, rho_prime,
    phi_Mn, Mu, phi_Vn, Vu,
    limit_state, barLayout, units
  });
  
  const warnings: string[] = [];
  if (limit_state === 'compression_controlled') {
    warnings.push('Section is compression-controlled (φ = 0.65). Consider increasing depth or adding compression steel.');
  }
  if (phi_Vn < Vu * 1.1) {
    warnings.push('Shear capacity is marginal. Stirrups will be required.');
  }
  
  return {
    success: true,
    inputs: req,
    Mu,
    Vu,
    section: {
      b,
      h,
      d,
      d_prime: As_prime > 0 ? d_prime : undefined,
      cover: req.constraints.cover ?? (units === 'US' ? 1.5 : 40)
    },
    As,
    As_prime: As_prime > 0 ? As_prime : undefined,
    rho,
    rho_prime,
    bar_layout: barLayout,
    phi_Mn,
    phi_Vn,
    phi,
    limit_state,
    epsilon_t,
    c,
    checks,
    warnings,
    rationale,
    code_version: 'ACI 318-19'
  };
}

/**
 * Perform design checks per ACI 318
 */
function performDesignChecks(
  req: DesignRequest,
  design: any
): CheckResult[] {
  const { fc, fy, units } = req;
  const { b, h, d, As, rho, phi_Mn, phi_Vn, Mu, Vu } = design;
  
  const checks: CheckResult[] = [];
  
  // Minimum reinforcement
  const rho_min = calculateMinRho(fc, fy, units);
  checks.push({
    name: 'Minimum reinforcement',
    passed: rho >= rho_min,
    value: rho,
    limit: rho_min,
    message: rho >= rho_min
      ? `ρ = ${rho.toFixed(4)} ≥ ρ_min = ${rho_min.toFixed(4)} ✓`
      : `ρ = ${rho.toFixed(4)} < ρ_min = ${rho_min.toFixed(4)} ✗`
  });
  
  // Maximum reinforcement (for singly reinforced)
  const rho_max = calculateMaxRhoSingly(fc, fy, units);
  const isDoublyReinforced = design.As_prime && design.As_prime > 0;
  if (!isDoublyReinforced) {
    checks.push({
      name: 'Maximum reinforcement (singly)',
      passed: rho <= rho_max,
      value: rho,
      limit: rho_max,
      message: rho <= rho_max
        ? `ρ = ${rho.toFixed(4)} ≤ ρ_max = ${rho_max.toFixed(4)} ✓`
        : `ρ = ${rho.toFixed(4)} > ρ_max = ${rho_max.toFixed(4)}, compression steel added`
    });
  }
  
  // Moment capacity (with tolerance for floating point)
  const momentCheck = phi_Mn >= Mu * 0.999; // Allow 0.1% tolerance
  checks.push({
    name: 'Moment capacity',
    passed: momentCheck,
    value: phi_Mn,
    limit: Mu,
    message: momentCheck
      ? `φM_n = ${phi_Mn.toFixed(1)} ≥ M_u = ${Mu.toFixed(1)} ✓`
      : `φM_n = ${phi_Mn.toFixed(1)} < M_u = ${Mu.toFixed(1)} ✗`
  });
  
  // Shear capacity (simplified)
  checks.push({
    name: 'Shear capacity',
    passed: phi_Vn >= Vu,
    value: phi_Vn,
    limit: Vu,
    message: phi_Vn >= Vu
      ? `φV_n = ${phi_Vn.toFixed(1)} ≥ V_u = ${Vu.toFixed(1)} ✓`
      : `φV_n = ${phi_Vn.toFixed(1)} < V_u = ${Vu.toFixed(1)}, stirrups required`
  });
  
  return checks;
}

/**
 * Generate human/AI-readable rationale
 */
function generateRationale(params: any): string {
  const {
    objective, b, h, d, As, As_prime, rho, rho_prime,
    phi_Mn, Mu, phi_Vn, Vu, limit_state, barLayout, units
  } = params;
  
  const unitStr = units === 'US' 
    ? { len: 'in', force: 'kip', moment: 'kip-ft' }
    : { len: 'mm', force: 'kN', moment: 'kN-m' };
  
  const lines: string[] = [];
  
  lines.push(`Design objective: ${objective.replace('_', ' ')}`);
  lines.push(`Selected section: b = ${b.toFixed(1)}${unitStr.len}, h = ${h.toFixed(1)}${unitStr.len}, d = ${d.toFixed(1)}${unitStr.len}`);
  lines.push(`Reinforcement: ${formatBarLayout(barLayout)}`);
  lines.push(`As = ${As.toFixed(2)}${unitStr.len}², ρ = ${rho.toFixed(4)}`);
  
  if (As_prime && As_prime > 0 && rho_prime) {
    lines.push(`Compression steel: As' = ${As_prime.toFixed(2)}${unitStr.len}², ρ' = ${rho_prime.toFixed(4)}`);
  }
  
  lines.push(`Section classification: ${limit_state.replace('_', ' ')}`);
  lines.push(`Moment: φM_n = ${phi_Mn.toFixed(1)}${unitStr.moment} vs M_u = ${Mu.toFixed(1)}${unitStr.moment} (${(phi_Mn/Mu*100).toFixed(0)}% capacity)`);
  lines.push(`Shear: φV_n = ${phi_Vn.toFixed(1)}${unitStr.force} vs V_u = ${Vu.toFixed(1)}${unitStr.force} (concrete only, stirrups may be required)`);
  
  return lines.join('\n');
}
