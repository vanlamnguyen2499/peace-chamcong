import { execSync } from 'child_process';
import * as fs from 'fs';

let content = fs.readFileSync('prisma/seed.js', 'utf8');

// We just want to extract the approvalTemplate upserts
const lines = content.split('\n');
const templateLines = [];
let capturing = false;

for (let line of lines) {
  if (line.includes('prisma.approvalTemplate.upsert')) capturing = true;
  if (capturing) {
    templateLines.push(line);
    if (line.trim() === '});' && templateLines.length > 5) {
      capturing = false;
    }
  }
}

const script = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
${templateLines.join('\n')}
}
main().catch(console.error).finally(() => prisma.$disconnect());
`;

fs.writeFileSync('scripts/seed_templates.js', script);
