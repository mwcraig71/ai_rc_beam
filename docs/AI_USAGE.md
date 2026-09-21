# AI Usage Guide for RC Beam Design

This document provides guidance for Large Language Models (LLMs) and AI agents integrating with the RC beam design tool.

## Overview

The RC beam design tool exposes a **structured JSON API** via CLI. Every design run returns:
- Inputs echoed (for auditability)
- Chosen section geometry and reinforcement
- Capacity ratios (φM_n / M_u, φV_n / V_u)
- Design checks (pass/fail with values and limits)
- Rationale string (human/AI-readable summary)

## JSON Request Schema

```typescript
{
  units: 'US' | 'SI',
  fc: number,              // Concrete strength (psi or MPa)
  fy: number,              // Steel yield (psi or MPa)
  loading: {
    mode: 'simple_span',
    span_length: number,   // ft or m
    dead_load: number,     // lb/ft or kN/m
    live_load: number      // lb/ft or kN/m
  } | {
    mode: 'direct',
    Mu: number,            // kip-ft or kN-m
    Vu: number             // kip or kN
  },
  objective: 'minimize_steel' | 'minimize_depth',
  constraints?: {
    b_min?: number,
    b_max?: number,
    b_step?: number,
    h_min?: number,
    h_max?: number,
    cover?: number,        // Clear cover
    max_layers?: number    // Max bar layers (1-3)
  },
  bar_preferences?: {
    min_bar_size?: '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11',
    max_bar_size?: '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11',
    preferred_sizes?: Array<BarSize>
  }
}
```

## JSON Response Schema

```typescript
{
  success: boolean,
  inputs: { /* echoed request */ },
  Mu: number,              // Factored moment
  Vu: number,              // Factored shear
  section: {
    b: number,             // Width
    h: number,             // Total depth
    d: number,             // Effective depth
    d_prime?: number,      // Compression steel depth (if any)
    cover: number
  },
  As: number,              // Tension steel area
  As_prime?: number,       // Compression steel area (if any)
  rho: number,             // Tension reinforcement ratio
  rho_prime?: number,      // Compression reinforcement ratio
  bar_layout: {
    tension_bars: Array<{
      size: BarSize,
      count: number,
      layer: number
    }>,
    compression_bars?: Array<{ /* same */ }>
  },
  phi_Mn: number,          // Design moment capacity
  phi_Vn: number,          // Design shear capacity
  phi: number,             // Strength reduction factor
  limit_state: 'tension_controlled' | 'transition' | 'compression_controlled',
  epsilon_t: number,       // Net tensile strain
  c: number,               // Neutral axis depth
  checks: Array<{
    name: string,
    passed: boolean,
    value?: number,
    limit?: number,
    message: string
  }>,
  warnings: Array<string>,
  rationale: string,       // Human-readable design summary
  code_version: string     // "ACI 318-19"
}
```

## Example AI Workflows

### Workflow 1: Simple Span Design

**Prompt**: "Design a 20 ft simply supported beam for 1 kip/ft dead load and 2 kip/ft live load. Use f'c = 4000 psi and fy = 60 ksi. Minimize steel."

**CLI Call**:
```bash
npx rc-beam design --json '{
  "units": "US",
  "fc": 4000,
  "fy": 60000,
  "loading": {
    "mode": "simple_span",
    "span_length": 20,
    "dead_load": 1000,
    "live_load": 2000
  },
  "objective": "minimize_steel"
}'
```

**AI Response Pattern**:
```
Design complete. Selected section: 12" × 24" beam with 4-#7 bars in tension.

Key results:
- Reinforcement: As = 2.40 in², ρ = 0.0083
- Capacity: φMn = 162 kip-ft vs Mu = 140 kip-ft (116% capacity)
- Section is tension-controlled (φ = 0.9)
- All checks passed ✓

See rationale below for full details:
[paste result.rationale]
```

### Workflow 2: Direct Moment Input

**Prompt**: "Check if a 14" × 30" beam with 5-#8 bars can handle Mu = 300 kip-ft and Vu = 40 kip."

**Strategy**: Use `minimize_depth` with tight constraints around known dimensions.

```bash
npx rc-beam design --json '{
  "units": "US",
  "fc": 4000,
  "fy": 60000,
  "loading": {
    "mode": "direct",
    "Mu": 300,
    "Vu": 40
  },
  "objective": "minimize_depth",
  "constraints": {
    "b_min": 14,
    "b_max": 14,
    "h_min": 30,
    "h_max": 30
  }
}'
```

**AI Checks**:
- Parse `checks` array: all `.passed === true`?
- Compare `As` from response vs given bars (5×0.79 = 3.95 in²)
- If `phi_Mn >= Mu` and `phi_Vn >= Vu`, confirm adequacy

### Workflow 3: Parametric Studies

**Prompt**: "Find the most economical beam depth (minimize steel) for spans from 15 to 30 ft in 5 ft increments, with DL=800 lb/ft and LL=1500 lb/ft."

**AI Task**:
1. Loop: span = 15, 20, 25, 30 ft
2. Call CLI for each with `minimize_steel`
3. Parse `As`, `section.h`, `bar_layout`
4. Generate table comparing steel quantities

**Output Format**:
```
Span    h (in)    As (in²)    Bar Layout       Cost Index
----    ------    --------    -----------      ----------
15 ft   18        1.56        3-#7             1.00
20 ft   22        2.40        4-#7             1.54
25 ft   26        3.60        3-#9             2.31
30 ft   30        5.08        4-#9 + 1-#8      3.26
```

## Error Handling

If `success === false`, the response includes:
```json
{
  "success": false,
  "warnings": ["Error message describing failure"]
}
```

**Common Errors**:
- "No feasible design found within constraints" → Relax b_max, h_max, or reduce load
- Zod validation error → Check JSON schema conformance

**AI Recovery**:
1. Parse error message
2. Identify constraint violation
3. Auto-adjust constraints (e.g., increase h_max by 20%)
4. Retry with explanation: "Initial constraints too tight. Increased max depth to X in."

## Best Practices for AI Agents

### 1. Always Echo Assumptions
Before calling the tool, state:
- Load combination used (e.g., "1.2D + 1.6L per ACI 5.3.1")
- Material properties
- Design objective rationale ("Minimizing depth to fit under ceiling")

### 2. Validate Inputs
- f'c: typical 3000–6000 psi (US), 20–40 MPa (SI)
- fy: typically 60000 psi (US), 420 MPa (SI)
- Loads: reasonable for building context (not bridge or heavy industrial unless stated)

### 3. Interpret Warnings
- "Shear capacity marginal" → Mention stirrup design required (not included in v1)
- "Compression-controlled" → Suggest increasing depth or adding compression steel

### 4. Cite the Rationale
The `rationale` field is structured for both humans and AIs. Quote it verbatim when presenting designs:

```
Design rationale (ACI 318-19):
[paste result.rationale]
```

### 5. Unit Consistency
- If user provides mixed units ("28 MPa concrete, 60 ksi steel"), convert before calling
- Document conversion factors used

## Advanced: Multi-Objective Optimization

**Scenario**: "Design the most economical beam (least steel) subject to h ≤ 24 in."

**Strategy**:
1. Call with `minimize_steel`, `h_max: 24`
2. If warning "depth constraint active", also try `minimize_depth` to see if shallower beam is feasible
3. Compare `As` between designs, recommend minimum

## Integration Checklist

- [ ] Parse JSON response into structured data (not plain text)
- [ ] Check `success` field before processing results
- [ ] Display all failed checks (`checks.filter(c => !c.passed)`)
- [ ] Include `code_version` in documentation/reports
- [ ] Handle both `simple_span` and `direct` loading modes
- [ ] Support US and SI units
- [ ] Test with edge cases (very high/low loads)

## Example Files

See `examples/` directory for:
- `example1.json` — Typical office beam (US)
- `example2.json` — High moment (doubly reinforced)
- `example3.json` — SI units (metric)

## Questions & Feedback

For AI developers integrating this tool:
- Open issues for unclear schema fields
- Request additional output fields if needed for your workflow
- Share example AI prompts that work well

This is an **AI-first** tool. Your feedback shapes the roadmap.
