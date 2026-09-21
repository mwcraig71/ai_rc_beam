# AI-First Reinforced Concrete Beam Design

A production-grade structural engineering tool for designing rectangular reinforced concrete beams per **ACI 318-19**. Primary interface is structured JSON (CLI), with a clean web UI for human engineers.

## Features

- **Singly and doubly reinforced** rectangular beam design
- **Two optimization modes**:
  - `minimize_steel` — minimize reinforcement area (economical)
  - `minimize_depth` — minimize beam depth (architectural)
- **Simple span analysis** (uniform DL+LL) or direct Mu/Vu input
- **Full ACI 318-19 compliance**:
  - Rectangular stress block (§22.2.2.4)
  - φ factors for tension/transition/compression-controlled sections (§21.2.2)
  - Minimum reinforcement (§9.6.1.2)
  - Basic shear capacity check (§22.5)
- **Practical constraints**: bar sizes #3–#11, cover, multi-layer layouts
- **Machine-readable output**: JSON with inputs echoed, geometry, reinforcement, capacity, checks, rationale

## Quick Start

### Installation

```bash
npm install
npm run build
```

### CLI Usage (AI-First Interface)

```bash
# Design from JSON string
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
}' --pretty

# Design from file
npx rc-beam design --file examples/example1.json --pretty

# Get schema documentation
npx rc-beam schema
```

### Web UI (Human Interface)

```bash
npm run dev:web
```

Open `http://localhost:5173` for an interactive design interface.

## Project Structure

```
rc-beam-design/
├── packages/
│   └── core/              # Design engine (pure TypeScript)
│       ├── src/
│       │   ├── types.ts          # Zod schemas for request/response
│       │   ├── constants.ts      # ACI constants, bar data
│       │   ├── calculations.ts   # Stress block, φ factors
│       │   ├── bar-layout.ts     # Reinforcement optimization
│       │   ├── designer.ts       # Main design algorithm
│       │   └── index.ts
│       └── designer.test.ts      # Unit tests
├── apps/
│   ├── cli/               # CLI tool (JSON I/O)
│   │   └── src/index.ts
│   └── web/               # Web UI (Vite + vanilla TS)
│       ├── index.html
│       └── src/main.ts
└── docs/
    └── AI_USAGE.md        # Guide for LLM callers
```

## Code Version: ACI 318-19

This implementation follows **ACI 318-19** Building Code Requirements for Structural Concrete:

- **§22.2.2.4**: Equivalent rectangular stress block (β₁)
- **§21.2.2**: Strength reduction factors φ
- **§9.6.1.2**: Minimum flexural reinforcement
- **§22.5**: Shear provisions (basic concrete capacity, Vc)

## Design Methodology

### 1. Input Validation
- Validate material properties (f'c, fy)
- Convert loading to factored Mu, Vu using ACI load combinations (1.2D + 1.6L)

### 2. Section Optimization
- **`minimize_steel`**: Start with maximum allowed height, minimize width
- **`minimize_depth`**: Start with minimum height, increase until feasible

### 3. Reinforcement Design
- Solve equilibrium: C = T (concrete compression = steel tension)
- Check ρ_min (ACI 9.6.1.2): max(3√f'c/fy, 200/fy)
- If ρ > ρ_max (tension-controlled limit), escalate to doubly reinforced
- Find practical bar layout minimizing excess steel

### 4. Capacity Verification
- Calculate neutral axis depth c and strain ε_t
- Determine φ from ε_t (ACI 21.2.2)
- Compute φM_n ≥ M_u and φV_n ≥ V_u

### 5. Output Generation
- Echo all inputs
- Report section geometry, bar layout
- List capacity checks with pass/fail
- Generate human/AI-readable rationale

## Assumptions & Limitations

### v1.0 Scope

✅ **Supported**:
- Rectangular sections (b × h)
- Singly and doubly reinforced beams
- Normal-weight concrete (λ = 1.0)
- Simple spans with uniform loads or direct Mu/Vu
- US customary (psi, in, kip-ft) and SI (MPa, mm, kN-m) units
- Bars #3–#11

❌ **Not Included** (future):
- T-beams, L-beams
- Continuous spans, moment redistribution
- Prestressed concrete
- Shear reinforcement design (stirrups)
- Torsion
- Seismic detailing (special moment frames)
- Deflection/serviceability checks
- Development length / splice design

### Simplifications

1. **Shear**: Reports φV_c (concrete shear capacity only). If φV_c < V_u, warns that stirrups are required but does not design them.
2. **Compression steel yielding**: Assumes f_s' ≤ fy based on strain compatibility; does not iterate for complex cases.
3. **Bar spacing**: Uses simplified rules (1 in or 25 mm clear spacing). Actual projects must verify ACI §25.2 detailing.
4. **Cover**: Default 1.5 in (US) / 40 mm (SI). Adjust for exposure/fire/corrosion per ACI §20.5.1.

## Units

### US Customary
- f'c: psi
- fy: psi
- Lengths: in (sections), ft (spans)
- Loads: lb/ft (uniform), kip-ft (moment), kip (shear)
- Areas: in²

### SI (Metric)
- f'c: MPa
- fy: MPa
- Lengths: mm (sections), m (spans)
- Loads: kN/m (uniform), kN-m (moment), kN (shear)
- Areas: mm²

## Testing

```bash
# Run unit tests
npm test

# Watch mode
npm test -- --watch
```

Test coverage includes:
- Singly reinforced beams (minimize_steel, minimize_depth)
- Doubly reinforced beams (high moment demand)
- SI units
- Minimum reinforcement checks
- Hand-calculated reference cases

## AI Integration

See [`docs/AI_USAGE.md`](docs/AI_USAGE.md) for:
- JSON request/response schemas
- Example prompts for LLM agents
- Error handling patterns
- Best practices for structural AI workflows

## Contributing

This is a v1.0 release focused on fundamental beam design. Contributions welcome for:
- Additional section shapes (T-beams, L-beams)
- Stirrup design
- Deflection checks
- ACI 318-22 updates
- International codes (Eurocode 2, CSA A23.3)

## License

MIT

## Disclaimer

This software is provided for educational and preliminary design purposes. All structural designs must be reviewed and stamped by a licensed Professional Engineer. The authors assume no liability for designs produced by this tool.
