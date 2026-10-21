// Saves the running backend's OpenAPI document to ./openapi.json (start the backend first: npm run start:dev).
import { writeFileSync } from 'node:fs';
const base = process.env.API_URL ?? 'http://localhost:3001';
const res = await fetch(`${base}/api/v1/docs-json`);
if (!res.ok) throw new Error(`Could not fetch OpenAPI (${res.status}). Is the backend running with Swagger enabled?`);
writeFileSync('openapi.json', JSON.stringify(await res.json(), null, 2) + '\n');
console.log('openapi.json written');
