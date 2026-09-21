import { BarSize, BarLayout, UnitSystem } from './types.js';
import { getBarData } from './constants.js';

/**
 * Find optimal bar layout for required steel area
 */
export function findBarLayout(
  As_required: number,
  b: number,
  cover: number,
  units: UnitSystem,
  minSize: BarSize = '4',
  maxSize: BarSize = '11',
  maxLayers: number = 2,
  preferredSizes?: BarSize[]
): { layout: BarLayout['tension_bars']; As_provided: number } | null {
  const sizes = preferredSizes || getAllBarSizes(minSize, maxSize);
  
  let bestLayout: { layout: BarLayout['tension_bars']; As_provided: number } | null = null;
  let minExcess = Infinity;
  
  for (const size of sizes) {
    const barData = getBarData(size, units);
    const spacing = units === 'US' ? 1.0 : 25; // Min clear spacing
    
    // Calculate max bars per layer
    // Available width = b - 2*(cover + stirrup + half bar)
    const availableWidth = b - 2 * (cover + barData.diameter);
    const maxBarsPerLayer = Math.floor((availableWidth + spacing) / (barData.diameter + spacing));
    
    if (maxBarsPerLayer < 1) continue;
    
    // Try different combinations
    for (let layers = 1; layers <= maxLayers; layers++) {
      const maxBars = maxBarsPerLayer * layers;
      const minBars = Math.ceil(As_required / barData.area);
      
      if (minBars > maxBars) continue;
      
      const nBars = minBars;
      const As_provided = nBars * barData.area;
      const excess = As_provided - As_required;
      
      if (excess >= 0 && excess < minExcess) {
        minExcess = excess;
        
        // Distribute bars across layers
        const barsPerLayer = Math.ceil(nBars / layers);
        const layout: BarLayout['tension_bars'] = [];
        
        let remaining = nBars;
        for (let layer = 1; layer <= layers; layer++) {
          const count = Math.min(barsPerLayer, remaining);
          if (count > 0) {
            layout.push({ size, count, layer });
            remaining -= count;
          }
        }
        
        bestLayout = { layout, As_provided };
      }
    }
  }
  
  return bestLayout;
}

/**
 * Get all bar sizes between min and max
 */
function getAllBarSizes(min: BarSize, max: BarSize): BarSize[] {
  const allSizes: BarSize[] = ['3', '4', '5', '6', '7', '8', '9', '10', '11'];
  const minIdx = allSizes.indexOf(min);
  const maxIdx = allSizes.indexOf(max);
  return allSizes.slice(minIdx, maxIdx + 1);
}

/**
 * Calculate centroid of bar layout (effective depth)
 */
export function calculateEffectiveDepth(
  h: number,
  cover: number,
  layout: BarLayout['tension_bars'],
  units: UnitSystem
): number {
  if (layout.length === 0) return h - cover;
  
  // Get bar diameter for spacing between layers
  const firstBar = getBarData(layout[0].size, units);
  const layerSpacing = units === 'US' ? 1.0 : 25; // Clear spacing between layers
  
  let sumAy = 0;
  let sumA = 0;
  
  for (const bar of layout) {
    const barData = getBarData(bar.size, units);
    const y = h - cover - barData.diameter / 2 - (bar.layer - 1) * (barData.diameter + layerSpacing);
    const area = barData.area * bar.count;
    
    sumAy += area * y;
    sumA += area;
  }
  
  return sumAy / sumA;
}

/**
 * Format bar layout as readable string
 */
export function formatBarLayout(layout: BarLayout): string {
  const tensionStr = layout.tension_bars
    .map(b => `${b.count}-#${b.size}${b.layer > 1 ? ` (layer ${b.layer})` : ''}`)
    .join(' + ');
  
  if (layout.compression_bars && layout.compression_bars.length > 0) {
    const compressionStr = layout.compression_bars
      .map(b => `${b.count}-#${b.size}${b.layer > 1 ? ` (layer ${b.layer})` : ''}`)
      .join(' + ');
    return `Tension: ${tensionStr}; Compression: ${compressionStr}`;
  }
  
  return `Tension: ${tensionStr}`;
}
