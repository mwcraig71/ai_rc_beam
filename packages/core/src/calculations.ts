import { ACI_CONSTANTS, getBeta1 } from './constants.js';
import { LimitState, UnitSystem } from './types.js';

/**
 * Calculate factored moment for simple span with uniform load
 * Wu = 1.2*DL + 1.6*LL (ACI 5.3.1)
 * Mu = Wu*L²/8
 * Returns moment in kip-ft (US) or kN-m (SI)
 * Inputs: load in lb/ft or kN/m, span in ft or m
 */
export function calculateSimpleSpanMoment(
  span: number,
  deadLoad: number,
  liveLoad: number
): number {
  const wu = 1.2 * deadLoad + 1.6 * liveLoad;
  const moment = (wu * span * span) / 8;
  // Convert lb-ft to kip-ft (US loads are in lb/ft)
  // For SI, loads are already in kN/m so result is in kN-m
  return moment / 1000;
}

/**
 * Calculate factored shear for simple span with uniform load
 * Vu = Wu*L/2
 * Returns shear in kip (US) or kN (SI)
 * Inputs: load in lb/ft or kN/m, span in ft or m
 */
export function calculateSimpleSpanShear(
  span: number,
  deadLoad: number,
  liveLoad: number
): number {
  const wu = 1.2 * deadLoad + 1.6 * liveLoad;
  const shear = (wu * span) / 2;
  // Convert lb to kip (US loads are in lb/ft)
  // For SI, loads are already in kN/m so result is in kN
  return shear / 1000;
}

/**
 * Calculate minimum steel ratio per ACI 9.6.1.2
 */
export function calculateMinRho(fc: number, fy: number, units: UnitSystem): number {
  // ACI 9.6.1.2: ρ_min = max(3√f'c/fy, 200/fy)
  const fcInPsi = units === 'SI' ? fc * 145.038 : fc;
  const fyInPsi = units === 'SI' ? fy * 145.038 : fy;
  
  const rho1 = (3 * Math.sqrt(fcInPsi)) / fyInPsi;
  const rho2 = 200 / fyInPsi;
  
  return Math.max(rho1, rho2);
}

/**
 * Calculate maximum steel ratio for singly-reinforced section
 * Based on epsilon_t = 0.004 at phi transition (conservative)
 */
export function calculateMaxRhoSingly(fc: number, fy: number, units: UnitSystem): number {
  const beta1 = getBeta1(fc, units);
  const Es = 29000000; // psi (approximation for both systems in calculation)
  
  // At transition: epsilon_t = 0.004, epsilon_c = 0.003
  // c/d = 0.003/(0.003+0.004) = 0.4286
  const c_over_d = ACI_CONSTANTS.EPSILON_CU / 
    (ACI_CONSTANTS.EPSILON_CU + 0.004);
  
  // a = beta1 * c
  const a_over_d = beta1 * c_over_d;
  
  // For singly reinforced: As*fy = 0.85*fc*a*b
  // rho = As/(b*d) = 0.85*fc*a/(fy*d)
  const rho_max = (0.85 * fc * a_over_d) / fy;
  
  return rho_max;
}

/**
 * Solve for neutral axis depth and resulting steel area
 * Returns {c, As, As_prime}
 */
export function solveRectangularSection(
  b: number,
  d: number,
  d_prime: number,
  Mu: number,
  fc: number,
  fy: number,
  units: UnitSystem
): { c: number; As: number; As_prime: number; converged: boolean } {
  const beta1 = getBeta1(fc, units);
  const Es = units === 'US' ? 29000000 : 200000; // psi or MPa
  
  // Convert moment to consistent units (kip-in or kN-mm)
  const Mu_in = units === 'US' ? Mu * 12 : Mu * 1000;
  
  // Direct iterative method: guess 'a', check phi, iterate
  // Start with a reasonable estimate based on balanced condition
  const c_balanced = d * ACI_CONSTANTS.EPSILON_CU / 
    (ACI_CONSTANTS.EPSILON_CU + ACI_CONSTANTS.EPSILON_T_TENSION_CONTROLLED);
  let a = beta1 * c_balanced * 0.5; // Start with half of balanced (under-reinforced)
  
  for (let iter = 0; iter < 30; iter++) {
    // Calculate As from equilibrium
    const As = (0.85 * fc * a * b) / fy;
    const c = a / beta1;
    
    // Check if c is reasonable
    if (c >= d) {
      // Neutral axis at or below tension steel - need doubly reinforced
      return solveDoublyReinforcedSection(b, d, d_prime, Mu_in, fc, fy, beta1, Es);
    }
    
    // Calculate strain and phi
    const epsilon_t = ACI_CONSTANTS.EPSILON_CU * (d - c) / c;
    const phi = calculatePhi(epsilon_t);
    
    // Calculate moment capacity
    const Mn = 0.85 * fc * a * b * (d - a / 2);
    const phi_Mn = phi * Mn;
    
    // Check convergence
    const error = (phi_Mn - Mu_in) / Mu_in;
    
    if (Math.abs(error) < 0.001) {
      // Converged!
      return { c, As, As_prime: 0, converged: true };
    }
    
    // Adjust 'a' based on error
    if (phi_Mn < Mu_in) {
      // Need more capacity - increase 'a'
      a = a * 1.1;
    } else {
      // Too much capacity - decrease 'a'
      a = a * 0.95;
    }
    
    // Safety check
    if (a > d * beta1 * 0.9) {
      // Getting too large - probably need doubly reinforced
      return solveDoublyReinforcedSection(b, d, d_prime, Mu_in, fc, fy, beta1, Es);
    }
  }
  
  // Didn't converge - try doubly reinforced
  return solveDoublyReinforcedSection(b, d, d_prime, Mu_in, fc, fy, beta1, Es);
}

/**
 * Solve doubly-reinforced section
 */
function solveDoublyReinforcedSection(
  b: number,
  d: number,
  d_prime: number,
  Mu: number,
  fc: number,
  fy: number,
  beta1: number,
  Es: number
): { c: number; As: number; As_prime: number; converged: boolean } {
  // Use epsilon_t = 0.005 (tension-controlled) to maximize capacity
  const epsilon_t = ACI_CONSTANTS.EPSILON_T_TENSION_CONTROLLED;
  const phi = ACI_CONSTANTS.PHI_TENSION_CONTROLLED;
  
  // From strain compatibility: c = d * epsilon_cu / (epsilon_cu + epsilon_t)
  const c = d * ACI_CONSTANTS.EPSILON_CU / (ACI_CONSTANTS.EPSILON_CU + epsilon_t);
  const a = beta1 * c;
  
  // Check if compression steel yields
  const epsilon_s_prime = ACI_CONSTANTS.EPSILON_CU * (c - d_prime) / c;
  const f_s_prime = Math.min(epsilon_s_prime * Es, fy);
  
  // Moment capacity from concrete and compression steel
  const Mn1 = 0.85 * fc * a * b * (d - a / 2);
  const Mn_required = Mu / phi;
  
  if (Mn_required <= Mn1) {
    // Compression steel not needed
    const As = (0.85 * fc * a * b) / fy;
    return { c, As, As_prime: 0, converged: true };
  }
  
  // Additional moment needed
  const Mn2 = Mn_required - Mn1;
  
  // As' = Mn2 / (f_s_prime * (d - d_prime))
  const As_prime = Mn2 / (f_s_prime * (d - d_prime));
  
  // Total tension steel
  const As = (0.85 * fc * a * b + As_prime * f_s_prime) / fy;
  
  return { c, As, As_prime, converged: true };
}

/**
 * Calculate phi factor based on net tensile strain (ACI 21.2.2)
 */
export function calculatePhi(epsilon_t: number): number {
  if (epsilon_t >= ACI_CONSTANTS.EPSILON_T_TENSION_CONTROLLED) {
    return ACI_CONSTANTS.PHI_TENSION_CONTROLLED;
  } else if (epsilon_t <= ACI_CONSTANTS.EPSILON_T_TRANSITION_MIN) {
    return ACI_CONSTANTS.PHI_COMPRESSION_CONTROLLED;
  } else {
    // Linear interpolation in transition zone
    const range = ACI_CONSTANTS.EPSILON_T_TENSION_CONTROLLED - 
                  ACI_CONSTANTS.EPSILON_T_TRANSITION_MIN;
    const phi_range = ACI_CONSTANTS.PHI_TENSION_CONTROLLED - 
                      ACI_CONSTANTS.PHI_COMPRESSION_CONTROLLED;
    
    return ACI_CONSTANTS.PHI_COMPRESSION_CONTROLLED + 
           phi_range * (epsilon_t - ACI_CONSTANTS.EPSILON_T_TRANSITION_MIN) / range;
  }
}

/**
 * Determine limit state from net tensile strain
 */
export function getLimitState(epsilon_t: number): LimitState {
  if (epsilon_t >= ACI_CONSTANTS.EPSILON_T_TENSION_CONTROLLED) {
    return 'tension_controlled';
  } else if (epsilon_t <= ACI_CONSTANTS.EPSILON_T_TRANSITION_MIN) {
    return 'compression_controlled';
  } else {
    return 'transition';
  }
}

/**
 * Calculate nominal shear capacity (simplified, no stirrups)
 * Vc = 2*lambda*sqrt(fc)*b*d (ACI 22.5.5.1)
 * phi*Vn = phi*Vc
 */
export function calculateShearCapacity(
  b: number,
  d: number,
  fc: number,
  units: UnitSystem
): number {
  const lambda = 1.0; // Normal weight concrete
  const sqrt_fc = Math.sqrt(units === 'US' ? fc : fc * 145.038);
  
  // Vc in lb or N
  const Vc = units === 'US'
    ? 2 * lambda * sqrt_fc * b * d
    : 0.17 * lambda * sqrt_fc * b * d; // SI uses different coefficient
  
  const phi_Vn = ACI_CONSTANTS.PHI_SHEAR * Vc;
  
  // Convert to kip or kN
  return units === 'US' ? phi_Vn / 1000 : phi_Vn / 1000;
}
