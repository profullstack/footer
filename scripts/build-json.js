// Writes template.json (what the CDN serves as @latest) from src/template.js.
import { writeFileSync } from 'node:fs';
import template from '../src/template.js';
import pkg from '../package.json' with { type: 'json' };

writeFileSync(new URL('../template.json', import.meta.url), JSON.stringify({ ...template, version: pkg.version }, null, 2) + '\n');
