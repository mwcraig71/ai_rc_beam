import { BarSize, UnitSystem } from './types.js';

/**
 * ACI 318-19 constants
 */
export const ACI_CONSTANTS = {
  BETA1_THRESHOLD_US: 4000, // psi
  BETA1_THRESHOLD_SI: 28,   // MPa
  EPSILON_Y: 0.002,         // Steel yield strain (typical)
  EPSILON_CU: 0.003,        // Concrete ultimate strain (ACI 22.2.2.1)
  
  // Strength reduction factors (ACI 21.2)
  PHI_TENSION_CONTROLLED: 0.9,
  PHI_COMPRESSION_CONTROLLED: 0.65,
  PHI_SHEAR: 0.75,
  
  // Strain limits (ACI 21.2.2)
  EPSILON_T_TENSION_CONTROLLED: 0.005,
  EPSILON_T_TRANSITION_MIN: 0.002,
  
  // Alpha for equivalent rectangular stress block
  ALPHA1: 0.85
} as const;

/**
 * Bar areas and diameters
 * US customary units: area in in², diameter in in
 */
export const BAR_DATA_US: Record<BarSize, { area: number; diameter: number }> = {
  '3': { area: 0.11, diameter: 0.375 },
  '4': { area: 0.20, diameter: 0.500 },
  '5': { area: 0.31, diameter: 0.625 },
  '6': { area: 0.44, diameter: 0.750 },
  '7': { area: 0.60, diameter: 0.875 },
  '8': { area: 0.79, diameter: 1.000 },
  '9': { area: 1.00, diameter: 1.128 },
  '10': { area: 1.27, diameter: 1.270 },
  '11': { area: 1.56, diameter: 1.410 }
};

/**
 * Bar areas and diameters
 * SI units: area in mm², diameter in mm
 */
export const BAR_DATA_SI: Record<BarSize, { area: number; diameter: number }> = {
  '3': { area: 71, diameter: 9.5 },
  '4': { area: 129, diameter: 12.7 },
  '5': { area: 200, diameter: 15.9 },
  '6': { area: 284, diameter: 19.1 },
  '7': { area: 387, diameter: 22.2 },
  '8': { area: 510, diameter: 25.4 },
  '9': { area: 645, diameter: 28.7 },
  '10': { area: 819, diameter: 32.3 },
  '11': { area: 1006, diameter: 35.8 }
};

/**
 * Get bar data for the specified unit system
 */
export function getBarData(size: BarSize, units: UnitSystem) {
  return units === 'US' ? BAR_DATA_US[size] : BAR_DATA_SI[size];
}

/**
 * Calculate beta1 per ACI 22.2.2.4.3
 */
export function getBeta1(fc: number, units: UnitSystem): number {
  const threshold = units === 'US' 
    ? ACI_CONSTANTS.BETA1_THRESHOLD_US 
    : ACI_CONSTANTS.BETA1_THRESHOLD_SI;
  
  if (fc <= threshold) {
    return 0.85;
  }
  
  const reduction = units === 'US' ? 0.05 / 1000 : 0.05 / 7;
  const beta1 = 0.85 - reduction * (fc - threshold);
  
  return Math.max(beta1, 0.65);
}

/**
 * Default geometric constraints based on unit system
 */
export function getDefaultConstraints(units: UnitSystem) {
  if (units === 'US') {
    return {
      b_min: 10,      // in
      b_max: 36,      // in
      b_step: 2,      // in
      h_min: 12,      // in
      h_max: 48,      // in
      cover: 1.5      // in
    };
  } else {
    return {
      b_min: 250,     // mm
      b_max: 900,     // mm
      b_step: 50,     // mm
      h_min: 300,     // mm
      h_max: 1200,    // mm
      cover: 40       // mm
    };
  }
}
