#!/usr/bin/env node

import { Command } from 'commander';
import { designBeam, DesignRequest, DesignRequestSchema } from '@rc-beam/core';
import * as fs from 'fs';

const program = new Command();

program
  .name('rc-beam')
  .description('AI-first reinforced concrete beam design tool')
  .version('1.0.0');

program
  .command('design')
  .description('Design a reinforced concrete beam')
  .option('--json <json>', 'JSON design request')
  .option('--file <path>', 'Path to JSON file with design request')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((options) => {
    try {
      let request: DesignRequest;
      
      if (options.json) {
        request = JSON.parse(options.json);
      } else if (options.file) {
        const fileContent = fs.readFileSync(options.file, 'utf-8');
        request = JSON.parse(fileContent);
      } else {
        console.error('Error: Must provide either --json or --file');
        process.exit(1);
      }
      
      // Validate request
      const validated = DesignRequestSchema.parse(request);
      
      // Perform design
      const result = designBeam(validated);
      
      // Output result
      const output = options.pretty 
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result);
      
      console.log(output);
      
      // Exit with appropriate code
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      const errorResponse = {
        success: false,
        error: (error as Error).message
      };
      
      console.error(JSON.stringify(errorResponse, null, 2));
      process.exit(1);
    }
  });

program
  .command('schema')
  .description('Output JSON schema for design request')
  .action(() => {
    // Generate example schema
    const exampleUS = {
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
        b_max: 20,
        b_step: 2,
        h_min: 18,
        h_max: 30,
        cover: 1.5,
        max_layers: 2
      },
      bar_preferences: {
        min_bar_size: '4',
        max_bar_size: '11'
      }
    };
    
    const exampleSI = {
      units: 'SI',
      fc: 28,
      fy: 420,
      loading: {
        mode: 'direct',
        Mu: 200,
        Vu: 100
      },
      objective: 'minimize_depth',
      constraints: {
        b_min: 250,
        b_max: 500,
        b_step: 50,
        h_min: 400,
        h_max: 800,
        cover: 40,
        max_layers: 2
      }
    };
    
    console.log(JSON.stringify({
      description: 'RC Beam Design Request Schema',
      examples: {
        us_customary: exampleUS,
        si_units: exampleSI
      },
      fields: {
        units: 'US or SI',
        fc: 'Concrete compressive strength (psi or MPa)',
        fy: 'Steel yield strength (psi or MPa)',
        loading: {
          simple_span: 'span_length, dead_load, live_load',
          direct: 'Mu (kip-ft or kN-m), Vu (kip or kN)'
        },
        objective: 'minimize_steel or minimize_depth',
        constraints: 'Optional geometric limits',
        bar_preferences: 'Optional bar size preferences'
      }
    }, null, 2));
  });

program.parse();
