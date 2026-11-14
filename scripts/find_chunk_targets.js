const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve('../space-deploy/_next/static/chunks/0xe3350okxckl.js');
const content = fs.readFileSync(chunkPath, 'utf8');

// Find quotation POST handler
const qPostIdx = content.indexOf('"/api/quotations"===m&&"POST"===l');
console.log('Quotation POST index:', qPostIdx);
if (qPostIdx !== -1) {
  console.log('Quotation POST snippet:', content.slice(qPostIdx, qPostIdx + 300));
}

// Find quotation PUT handler
const qPutIdx = content.indexOf('"PUT"===l){if(!w)return c({error:"Not found"},404);let e=await _();Object.assign(w');
console.log('Quotation PUT index:', qPutIdx);

// Find ai-import handler
const aiIdx = content.indexOf('"/api/ai-import"===m&&"POST"===l');
console.log('AI import index:', aiIdx);
if (aiIdx !== -1) {
  console.log('AI import snippet:', content.slice(aiIdx, aiIdx + 300));
}

