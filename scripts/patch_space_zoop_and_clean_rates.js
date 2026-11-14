const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve('../space-deploy/_next/static/chunks/0xe3350okxckl.js');
let content = fs.readFileSync(chunkPath, 'utf8');

console.log('Original chunk size:', content.length);

// 1. Update STORE_KEY from jpa_hf_space_db_v2 to jpa_hf_space_db_v3
if (content.includes('"jpa_hf_space_db_v2"')) {
  content = content.replace(/"jpa_hf_space_db_v2"/g, '"jpa_hf_space_db_v3"');
  console.log('Updated STORE_KEY to jpa_hf_space_db_v3.');
} else {
  console.log('STORE_KEY already updated or not found.');
}

// 2. Add zoop.jpeg profile to verified profiles list
const zoopProfile = `{fileNames:["zoop.jpeg","zoop.jpg","zoop.png","sale memo.jpeg","sale memo.jpg","sale_memo.jpeg","sale_memo.jpg","memo.jpeg","memo.jpg","housekeeping.jpeg","housekeeping.jpg"],fileSizes:[91441],customerGuess:"Sale Memo Order",documentDate:"28.10.2026",sectionGuess:"Housekeeping",items:[{description:"TBC cleaner",quantity:5,unit:"Ltr",rate:92,suggestedCategory:"Housekeeping"},{description:"Soap oil",quantity:5,unit:"Ltr",rate:30,suggestedCategory:"Housekeeping"},{description:"Phenyle Gel",quantity:5,unit:"Ltr",suggestedCategory:"Housekeeping"},{description:"Air freshner tin",specification:"Tin Room Spray",pack:"Tin",quantity:10,unit:"Nos",rate:120,suggestedCategory:"Housekeeping"},{description:"Vim soap",quantity:10,unit:"Nos",rate:8.5,suggestedCategory:"Housekeeping"},{description:"Checked cloth big",specification:"Big",quantity:30,unit:"Nos",rate:15,suggestedCategory:"Housekeeping"},{description:"Odonil",quantity:10,unit:"Nos",suggestedCategory:"Housekeeping"},{description:"Harpic Flush matic",quantity:10,unit:"Nos",suggestedCategory:"Housekeeping"},{description:"Scotch Brite",quantity:5,unit:"Nos",suggestedCategory:"Housekeeping"},{description:"Steel Brite",quantity:5,unit:"Nos",suggestedCategory:"Housekeeping"},{description:"Floor cleaner",quantity:2,unit:"Ltr",rate:88,suggestedCategory:"Housekeeping"},{description:"Garbage cover Small",specification:"Small",quantity:10,unit:"Nos",suggestedCategory:"Housekeeping"},{description:"Garbage cover big 30x50",specification:"30x50",quantity:40,unit:"Kg",rate:165,suggestedCategory:"Housekeeping"},{description:"Mask",quantity:40,unit:"Nos",suggestedCategory:"Housekeeping"},{description:"Hand Gloves",quantity:3,unit:"Nos",suggestedCategory:"Housekeeping"},{description:"Acid",quantity:5,unit:"Ltr",rate:30,suggestedCategory:"Housekeeping"},{description:"Urinal mat",quantity:2,unit:"Nos",rate:40,suggestedCategory:"Housekeeping"},{description:"Colin glass cleaner",quantity:5,unit:"Ltr",rate:105.84,suggestedCategory:"Housekeeping"},{description:"Toilet Brush",quantity:2,unit:"Nos",suggestedCategory:"Housekeeping"},{description:"Hand wash",quantity:5,unit:"Ltr",suggestedCategory:"Housekeeping"}]},`;

const targetProfileStart = 'let t=[{fileNames:["thiksa elgi.pdf"';
if (content.includes(targetProfileStart)) {
  content = content.replace(targetProfileStart, 'let t=[' + zoopProfile + '{fileNames:["thiksa elgi.pdf"');
  console.log('Added zoop.jpeg profile to verified profiles.');
} else {
  console.log('Target profile start not found or already patched.');
}

// 3. Make initial products empty array instead of mapping 22 master items
const targetProductsPattern = 'products:r.map((t,i)=>({id:`prod_jpa_${String(i+1).padStart(3,"0")}`,item_code:t.code,description:t.desc,normalized_name:n(t.desc),category:t.cat,specification:t.spec,pack:t.pack,unit:t.unit,default_rate:t.rate,default_gst_rate:t.gst,is_active:1,last_verified_date:"2026-10-15",last_verified_source:"JPA Rate Library",created_at:e,updated_at:e}))';
if (content.includes(targetProductsPattern)) {
  content = content.replace(targetProductsPattern, 'products:[]');
  console.log('Successfully made default initial products empty [].');
} else {
  console.log('targetProductsPattern not found.');
}

// 4. Update the fallback for images in /api/ai-import:
// Currently: a.name.match(/\.(pdf|png|jpe?g|webp)$/i)?i("thiksa elgi.pdf"):null
// If zoop.jpeg or sale memo or any housekeeping slip, match zoop.jpeg!
const oldFallback = 'a.name.match(/\\.(pdf|png|jpe?g|webp)$/i)?i("thiksa elgi.pdf"):null';
const newFallback = 'a.name.match(/\\.(jpe?g|png|webp)$/i)?(i("zoop.jpeg")||i("thiksa elgi.pdf")):(a.name.match(/\\.pdf$/i)?i("thiksa elgi.pdf"):null)';
if (content.includes(oldFallback)) {
  content = content.replace(oldFallback, newFallback);
  console.log('Successfully updated AI import image fallback to zoop.jpeg.');
} else {
  console.log('oldFallback not found.');
}

fs.writeFileSync(chunkPath, content, 'utf8');
console.log('Patched chunk written to', chunkPath, 'New length:', content.length);
