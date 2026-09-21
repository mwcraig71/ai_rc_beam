import { z } from 'zod';

/**
 * Unit system for inputs/outputs
 */
export const UnitSystemSchema = z.enum(['US', 'SI']);
export type UnitSystem = z.infer<typeof UnitSystemSchema>;

/**
 * Standard reinforcing bar sizes
 */
export const BarSizeSchema = z.enum(['3', '4', '5', '6', '7', '8', '9', '10', '11']);
export type BarSize = z.infer<typeof BarSizeSchema>;

/**
 * Optimization objective
 */
export const ObjectiveModeSchema = z.enum(['minimize_steel', 'minimize_depth']);
export type ObjectiveMode = z.infer<typeof ObjectiveModeSchema>;

/**
 * Load type for simple span analysis
 */
export const LoadTypeSchema = z.enum(['uniform', 'point_midspan']);
export type LoadType = z.infer<typeof LoadTypeSchema>;

/**
 * Section limit state classification
 */
export const LimitStateSchema = z.enum([
  'tension_controlled',
  'transition',
  'compression_controlled'
]);
export type LimitState = z.infer<typeof LimitStateSchema>;

/**
 * Design request input schema
 */
export const DesignRequestSchema = z.object({
  units: UnitSystemSchema.default('US'),
  
  // Material properties
  fc: z.number().positive().describe("Concrete compressive strength (psi or MPa)"),
  fy: z.number().positive().describe("Steel yield strength (psi or MPa)"),
  
  // Loading - either provide loads for simple span or direct moment/shear
  loading: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('simple_span'),
      span_length: z.number().positive().describe("Span length (ft or m)"),
      dead_load: z.number().nonnegative().describe("Uniform dead load (lb/ft or kN/m)"),
      live_load: z.number().nonnegative().describe("Uniform live load (lb/ft or kN/m)")
    }),
    z.object({
      mode: z.literal('direct'),
      Mu: z.number().positive().describe("Factored moment (kip-ft or kN-m)"),
      Vu: z.number().positive().describe("Factored shear (kip or kN)")
    })
  ]),
  
  // Design objective
  objective: ObjectiveModeSchema,
  
  // Geometric constraints (optional)
  constraints: z.object({
    b_min: z.number().positive().optional().describe("Min width (in or mm)"),
    b_max: z.number().positive().optional().describe("Max width (in or mm)"),
    b_step: z.number().positive().optional().describe("Width increment (in or mm)"),
    h_min: z.number().positive().optional().describe("Min total height (in or mm)"),
    h_max: z.number().positive().optional().describe("Max total height (in or mm)"),
    cover: z.number().positive().default(1.5).describe("Clear cover (in or mm)"),
    max_layers: z.number().int().min(1).max(3).default(2).describe("Max bar layers")
  }).default({}),
  
  // Bar preferences (optional)
  bar_preferences: z.object({
    min_bar_size: BarSizeSchema.default('4'),
    max_bar_size: BarSizeSchema.default('11'),
    preferred_sizes: z.array(BarSizeSchema).optional()
  }).default({})
});

export type DesignRequest = z.infer<typeof DesignRequestSchema>;

/**
 * Bar layout description
 */
export const BarLayoutSchema = z.object({
  tension_bars: z.array(z.object({
    size: BarSizeSchema,
    count: z.number().int().positive(),
    layer: z.number().int().min(1)
  })),
  compression_bars: z.array(z.object({
    size: BarSizeSchema,
    count: z.number().int().positive(),
    layer: z.number().int().min(1)
  })).optional()
});

export type BarLayout = z.infer<typeof BarLayoutSchema>;

/**
 * Design check result
 */
export const CheckResultSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  value: z.number().optional(),
  limit: z.number().optional(),
  message: z.string()
});

export type CheckResult = z.infer<typeof CheckResultSchema>;

/**
 * Complete design response
 */
export const DesignResponseSchema = z.object({
  success: z.boolean(),
  
  // Echo inputs
  inputs: DesignRequestSchema,
  
  // Computed loading
  Mu: z.number().describe("Factored moment (kip-ft or kN-m)"),
  Vu: z.number().describe("Factored shear (kip or kN)"),
  
  // Section geometry
  section: z.object({
    b: z.number().describe("Width (in or mm)"),
    h: z.number().describe("Total depth (in or mm)"),
    d: z.number().describe("Effective depth to tension steel (in or mm)"),
    d_prime: z.number().optional().describe("Depth to compression steel (in or mm)"),
    cover: z.number().describe("Clear cover (in or mm)")
  }),
  
  // Reinforcement
  As: z.number().describe("Tension steel area (in² or mm²)"),
  As_prime: z.number().optional().describe("Compression steel area (in² or mm²)"),
  rho: z.number().describe("Tension reinforcement ratio"),
  rho_prime: z.number().optional().describe("Compression reinforcement ratio"),
  bar_layout: BarLayoutSchema,
  
  // Capacity
  phi_Mn: z.number().describe("Design moment capacity (kip-ft or kN-m)"),
  phi_Vn: z.number().describe("Design shear capacity (kip or kN)"),
  phi: z.number().describe("Strength reduction factor"),
  
  // Classification
  limit_state: LimitStateSchema,
  epsilon_t: z.number().describe("Net tensile strain"),
  c: z.number().describe("Neutral axis depth (in or mm)"),
  
  // Checks
  checks: z.array(CheckResultSchema),
  warnings: z.array(z.string()),
  
  // Rationale
  rationale: z.string().describe("Human/AI-readable design summary"),
  
  // Code reference
  code_version: z.string().default("ACI 318-19")
});

export type DesignResponse = z.infer<typeof DesignResponseSchema>;
