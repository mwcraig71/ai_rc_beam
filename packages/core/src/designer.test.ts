import { describe, it, expect } from 'vitest';
import { designBeam } from './designer.js';
import { DesignRequest } from './types.js';

describe('RC Beam Designer', () => {
  it('designs singly-reinforced beam with minimize_steel objective', () => {
    const request: DesignRequest = {
      units: 'US',
      fc: 4000,
      fy: 60000,
      loading: {
        mode: 'simple_span',
        span_length: 20,
        dead_load: 1000,
        live_load: 2000
      },
      objective: 'minimize_steel',
      constraints: {
        b_min: 10,
        b_max: 18,
        b_step: 2,
        h_min: 18,
        h_max: 24,
        cover: 1.5,
        max_layers: 2
      },
      bar_preferences: {
        min_bar_size: '5',
        max_bar_size: '9'
      }
    };
    
    const result = designBeam(request);
    
    expect(result.success).toBe(true);
    expect(result.section.b).toBeGreaterThanOrEqual(10);
    expect(result.section.h).toBeLessThanOrEqual(24);
    expect(result.phi_Mn).toBeGreaterThanOrEqual(result.Mu);
    expect(result.limit_state).toBe('tension_controlled');
    expect(result.checks.every(c => c.passed)).toBe(true);
  });
  
  it('designs beam with minimize_depth objective', () => {
    const request: DesignRequest = {
      units: 'US',
      fc: 4000,
      fy: 60000,
      loading: {
        mode: 'direct',
        Mu: 150,
        Vu: 25
      },
      objective: 'minimize_depth',
      constraints: {
        b_min: 12,
        b_max: 16,
        b_step: 2,
        h_min: 16,
        h_max: 30,
        cover: 1.5,
        max_layers: 2
      }
    };
    
    const result = designBeam(request);
    
    expect(result.success).toBe(true);
    expect(result.phi_Mn).toBeGreaterThanOrEqual(result.Mu);
    expect(result.section.h).toBeLessThan(30);
  });
  
  it('handles high moment requiring doubly-reinforced section', () => {
    const request: DesignRequest = {
      units: 'US',
      fc: 4000,
      fy: 60000,
      loading: {
        mode: 'direct',
        Mu: 400,
        Vu: 50
      },
      objective: 'minimize_depth',
      constraints: {
        b_min: 12,
        b_max: 18,
        b_step: 2,
        h_min: 20,
        h_max: 36,
        cover: 1.5,
        max_layers: 2
      }
    };
    
    const result = designBeam(request);
    
    expect(result.success).toBe(true);
    expect(result.As_prime).toBeGreaterThan(0);
    expect(result.bar_layout.compression_bars).toBeDefined();
    expect(result.phi_Mn).toBeGreaterThanOrEqual(result.Mu);
  });
  
  it('designs SI units beam correctly', () => {
    const request: DesignRequest = {
      units: 'SI',
      fc: 28,
      fy: 420,
      loading: {
        mode: 'simple_span',
        span_length: 6,
        dead_load: 15,
        live_load: 25
      },
      objective: 'minimize_steel',
      constraints: {
        b_min: 250,
        b_max: 400,
        b_step: 50,
        h_min: 400,
        h_max: 600,
        cover: 40,
        max_layers: 2
      }
    };
    
    const result = designBeam(request);
    
    expect(result.success).toBe(true);
    expect(result.section.b).toBeGreaterThanOrEqual(250);
    expect(result.phi_Mn).toBeGreaterThanOrEqual(result.Mu);
  });
  
  it('respects minimum reinforcement requirements', () => {
    const request: DesignRequest = {
      units: 'US',
      fc: 4000,
      fy: 60000,
      loading: {
        mode: 'direct',
        Mu: 20,
        Vu: 5
      },
      objective: 'minimize_steel',
      constraints: {
        h_max: 24,
        cover: 1.5
      }
    };
    
    const result = designBeam(request);
    
    expect(result.success).toBe(true);
    const minRhoCheck = result.checks.find(c => c.name === 'Minimum reinforcement');
    expect(minRhoCheck?.passed).toBe(true);
  });
});
