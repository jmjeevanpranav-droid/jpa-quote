const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve('../space-deploy/_next/static/chunks/0xe3350okxckl.js');
let content = fs.readFileSync(chunkPath, 'utf8');

// 1. Remove the account-clearing filter in ensureCleanAdminStorage
const oldFilter = 'let e=t.filter(e=>e?.user?.email?.toLowerCase()===S);localStorage.setItem(f,JSON.stringify(e))';
const newFilter = '// Preserved multi-account storage for all employees';
if (content.includes(oldFilter)) {
  content = content.replace(oldFilter, newFilter);
  console.log('Successfully patched ensureCleanAdminStorage filter.');
} else {
  console.log('ensureCleanAdminStorage filter already patched or not found.');
}

// 2. Patch login handler to support Phone or Gmail
const targetLogin = 'if("/api/auth/login"===m&&"POST"===l){let e=await _(),t=String(e.email||"").toLowerCase().trim(),i=String(e.password||""),s=y.users.find(e=>e.email.toLowerCase()===t);return!s||s.passwordPlain&&s.passwordPlain!==i?c({error:"Invalid email or password"},401):(s.last_sign_in_at=f,s.last_active_at=f,u(y),c({success:!0,token:`hf_sess_${s.id}_${Date.now()}`,user:{id:s.id,userId:s.id,email:s.email,name:s.name,role:s.role}}))}';

const replacementLogin = 'if("/api/auth/login"===m&&"POST"===l){let e=await _();let norm=v=>String(v||"").replace(/[^\\d]/g,"").slice(-10);let rawId=String(e.identifier||e.email||e.phone||e.contact||"").toLowerCase().trim();let idNorm=norm(rawId);let pwd=String(e.password||"");let s=y.users.find(u=>{if(u.email&&u.email.toLowerCase()===rawId)return true;if(idNorm.length>=10&&u.contact&&norm(u.contact)===idNorm)return true;return false});if(!s)return c({error:"Invalid email or phone number, or password."},401);if(s.passwordPlain&&s.passwordPlain!==pwd)return c({error:"Invalid password."},401);s.last_sign_in_at=f;s.last_active_at=f;u(y);return c({success:!0,token:`hf_sess_${s.id}_${Date.now()}`,user:{id:s.id,userId:s.id,email:s.email,name:s.name,role:s.role,contact:s.contact}})}' +
';if("/api/auth/register"===m&&"POST"===l){let e=await _();let norm=v=>String(v||"").replace(/[^\\d]/g,"").slice(-10);let name=String(e.name||"").trim();let phone=String(e.contact||e.phnumber||e.phone||"").trim();let phoneNorm=norm(phone);let email=String(e.email||e.gmail||"").toLowerCase().trim();let pwd=String(e.password||"");if(!name||name.length<2)return c({error:"Please enter your full name (at least 2 chars)."},400);if(!phoneNorm||phoneNorm.length<10)return c({error:"Please enter a valid 10-digit phone number."},400);if(!email||!email.includes("@"))return c({error:"Please enter a valid Gmail / Email address."},400);if(!pwd||pwd.length<6)return c({error:"Password must be at least 6 characters."},400);if(y.users.find(u=>u.email.toLowerCase()===email))return c({error:"An employee with this Gmail already exists."},409);if(y.users.find(u=>u.contact&&norm(u.contact)===phoneNorm))return c({error:"An employee with this Phone Number already exists."},409);let formattedPhone="+91 "+phoneNorm;let newUser={id:`usr_emp_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,email:email,name:name,contact:formattedPhone,role:"staff",passwordPlain:pwd,created_at:f,last_sign_in_at:f,last_active_at:f};y.users.push(newUser);u(y);return c({success:!0,token:`hf_sess_${newUser.id}_${Date.now()}`,user:{id:newUser.id,userId:newUser.id,email:newUser.email,name:newUser.name,role:newUser.role,contact:newUser.contact}})}';

if (content.includes(targetLogin)) {
  content = content.replace(targetLogin, replacementLogin);
  console.log('Successfully patched /api/auth/login and added /api/auth/register.');
} else {
  console.error('ERROR: targetLogin string not found!');
}

// 3. Patch /api/admin/users to support POST (Add Employee)
const targetAdminUsers = 'if("/api/admin/users"===m&&"GET"===l)return c({users:y.users.map(e=>({id:e.id,email:e.email,name:e.name,contact:e.contact,role:e.role,created_at:e.created_at,last_sign_in_at:e.last_sign_in_at,last_active_at:e.last_active_at,quote_count:(y.quotations||[]).length,total_value:(y.quotations||[]).reduce((e,t)=>e+Number(t.grand_total||0),0),approved_count:(y.quotations||[]).filter(e=>"approved"===e.status).length,draft_count:(y.quotations||[]).filter(e=>"draft"===e.status).length}))});';

const replacementAdminUsers = 'if("/api/admin/users"===m){if("GET"===l)return c({users:y.users.map(e=>({id:e.id,email:e.email,name:e.name,contact:e.contact,role:e.role,created_at:e.created_at,last_sign_in_at:e.last_sign_in_at,last_active_at:e.last_active_at,quote_count:(y.quotations||[]).length,total_value:(y.quotations||[]).reduce((e,t)=>e+Number(t.grand_total||0),0),approved_count:(y.quotations||[]).filter(e=>"approved"===e.status).length,draft_count:(y.quotations||[]).filter(e=>"draft"===e.status).length}))});if("POST"===l){let e=await _();let norm=v=>String(v||"").replace(/[^\\d]/g,"").slice(-10);let name=String(e.name||"").trim();let phone=String(e.contact||e.phnumber||e.phone||"").trim();let phoneNorm=norm(phone);let email=String(e.email||e.gmail||"").toLowerCase().trim();let pwd=String(e.password||"");let role="admin"===e.role?"admin":"staff";if(!name||name.length<2)return c({error:"Please enter employee name (at least 2 chars)."},400);if(!phoneNorm||phoneNorm.length<10)return c({error:"Please enter a valid 10-digit phone number."},400);if(!email||!email.includes("@"))return c({error:"Please enter a valid Gmail / Email."},400);if(!pwd||pwd.length<6)return c({error:"Password must be at least 6 chars."},400);if(y.users.find(u=>u.email.toLowerCase()===email))return c({error:"An employee with this Gmail already exists."},409);if(y.users.find(u=>u.contact&&norm(u.contact)===phoneNorm))return c({error:"An employee with this Phone Number already exists."},409);let formattedPhone="+91 "+phoneNorm;let newUser={id:`usr_emp_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,email:email,name:name,contact:formattedPhone,role:role,passwordPlain:pwd,created_at:f,last_sign_in_at:null,last_active_at:null};y.users.push(newUser);u(y);return c({success:!0,message:`Employee "${name}" registered successfully.`,user:{...newUser,metrics:{quoteCount:0,totalValue:0},quotations:[],activities:[]}})}if("PATCH"===l){let e=await _(),t=y.users.find(t=>t.id===e.userId);return t&&"usr_admin_1"!==t.id?(t.role=e.role,u(y),c({success:!0})):c({error:"Cannot update user role"},400)}if("DELETE"===l){let e=d.searchParams.get("id");return e&&"usr_admin_1"!==e?(y.users=y.users.filter(t=>t.id!==e),u(y),c({success:!0})):c({error:"Cannot remove user"},400)}}';

if (content.includes(targetAdminUsers)) {
  content = content.replace(targetAdminUsers, replacementAdminUsers);
  console.log('Successfully patched /api/admin/users (GET, POST, PATCH, DELETE).');
} else {
  console.error('ERROR: targetAdminUsers string not found!');
}

fs.writeFileSync(chunkPath, content, 'utf8');
console.log('Saved patched chunk to', chunkPath);
