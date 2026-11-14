const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve('../space-deploy/_next/static/chunks/21wgr11t-vumc.js');
let content = fs.readFileSync(chunkPath, 'utf8');

// 1. Update input field
const targetInput = 'type:"email",required:!0,value:C,onChange:e=>_(e.target.value),placeholder:"Email Address","aria-label":"Email Address"';
const replacementInput = 'type:"text",required:!0,value:C,onChange:e=>_(e.target.value),placeholder:"Gmail or Phone Number (e.g. 9790600971)","aria-label":"Gmail or Phone Number"';

if (content.includes(targetInput)) {
  content = content.replace(targetInput, replacementInput);
  console.log('Successfully updated input to text with dual Gmail / Phone Number placeholder.');
} else {
  console.error('ERROR: targetInput not found!');
}

// 2. Update submit body
const targetBody = 'body:JSON.stringify({email:C,password:A,rememberMe:E,recaptchaToken:"google_recaptcha_verified_admin_token"})';
const replacementBody = 'body:JSON.stringify({identifier:C.trim(),email:C.trim(),phone:C.trim(),contact:C.trim(),password:A,rememberMe:E,recaptchaToken:"google_recaptcha_verified_admin_token"})';

if (content.includes(targetBody)) {
  content = content.replace(targetBody, replacementBody);
  console.log('Successfully updated login submit body with identifier, phone, email.');
} else {
  console.error('ERROR: targetBody not found!');
}

fs.writeFileSync(chunkPath, content, 'utf8');
console.log('Saved patched chunk to', chunkPath);

