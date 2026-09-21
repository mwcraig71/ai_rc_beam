# Quick Start Guide

Get started with RC beam design in 5 minutes.

## Installation

```bash
git clone <repository-url>
cd ai_rc_beam
npm install
npm run build
```

## Quick Test

### 1. CLI Design

Design a 20 ft simple span beam:

```bash
node apps/cli/dist/index.js design --file examples/example1.json --pretty
```

**Expected output**: 10" × 30" beam with 5-#9 bars, φMn = 297.7 kip-ft

### 2. Web UI

```bash
npm run dev:web
```

Open http://localhost:5173 and try:
- Material: f'c = 4000 psi, fy = 60 ksi
- Loading: 20 ft span, DL = 1 kip/ft, LL = 2 kip/ft
- Objective: Minimize steel
- Click "Design Beam"

### 3. JSON API Example

Save this as `my-design.json`:

```json
{
  "units": "US",
  "fc": 4000,
  "fy": 60000,
  "loading": {
    "mode": "direct",
    "Mu": 150,
    "Vu": 25
  },
  "objective": "minimize_depth"
}
```

Run:
```bash
node apps/cli/dist/index.js design --file my-design.json --pretty
```

## Common Design Scenarios

### Office Building Floor Beam

```json
{
  "units": "US",
  "fc": 4000,
  "fy": 60000,
  "loading": {
    "mode": "simple_span",
    "span_length": 25,
    "dead_load": 800,
    "live_load": 1600
  },
  "objective": "minimize_steel",
  "constraints": {
    "h_max": 28,
    "cover": 1.5
  }
}
```

### Parking Garage Beam (High Load)

```json
{
  "units": "US",
  "fc": 5000,
  "fy": 60000,
  "loading": {
    "mode": "simple_span",
    "span_length": 30,
    "dead_load": 1200,
    "live_load": 3000
  },
  "objective": "minimize_depth",
  "constraints": {
    "h_max": 36
  }
}
```

### Architectural Constraint (Shallow Depth)

```json
{
  "units": "US",
  "fc": 5000,
  "fy": 60000,
  "loading": {
    "mode": "direct",
    "Mu": 300,
    "Vu": 40
  },
  "objective": "minimize_depth",
  "constraints": {
    "h_max": 24,
    "b_min": 14
  }
}
```

## AI Agent Integration

For AI assistants (ChatGPT, Claude, etc.):

1. **Read the schema**:
   ```bash
   node apps/cli/dist/index.js schema
   ```

2. **Design workflow**:
   - Generate JSON request from user requirements
   - Call CLI with `--json` flag
   - Parse JSON response
   - Extract `rationale` field for user explanation
   - Check `checks` array for violations

3. **See `docs/AI_USAGE.md`** for complete integration guide

## Troubleshooting

**"No feasible design found"**
- Increase `h_max` or `b_max`
- Check if loads are realistic
- Try opposite objective mode

**"Shear capacity marginal"**
- This is a warning (not an error)
- Stirrups will be required (not designed in v1.0)
- Design is still valid for flexure

**"Compression-controlled"**
- Section is over-reinforced
- Increase depth or add compression steel
- Tool will automatically add As' if possible

## Next Steps

- Read full README.md for methodology
- See docs/AI_USAGE.md for AI integration
- Explore examples/example1-3.json
- Review ACI 318-19 for code details

---

**Support**: Open an issue if you encounter problems or have questions.
