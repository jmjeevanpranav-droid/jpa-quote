const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve('../space-deploy/_next/static/chunks/0foh8_w09uxv6.js');
let content = fs.readFileSync(chunkPath, 'utf8');

// 1. Add "+ Add Employee" button into the Registered Employees header in settings React chunk
const targetHeader = '(0,t.jsxs)("div",{className:"flex flex-wrap items-center gap-3",children:[(0,t.jsxs)("div",{className:"px-4 py-2 rounded-xl bg-slate-100/80';
const replacementHeader = '(0,t.jsxs)("div",{className:"flex flex-wrap items-center gap-3",children:[(0,t.jsx)("button",{type:"button",onClick:()=>window.__jpa_open_add_employee_modal&&window.__jpa_open_add_employee_modal(),className:"px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11pt] font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all duration-150 active:scale-95 cursor-pointer select-none",children:[(0,t.jsx)("span",{children:"+ Add Employee"})]}),(0,t.jsxs)("div",{className:"px-4 py-2 rounded-xl bg-slate-100/80';

if (content.includes(targetHeader)) {
  content = content.replace(targetHeader, replacementHeader);
  console.log('Successfully injected Add Employee button in 0foh8_w09uxv6.js React chunk.');
} else {
  console.error('ERROR: targetHeader string not found in 0foh8_w09uxv6.js!');
}

fs.writeFileSync(chunkPath, content, 'utf8');
console.log('Saved patched chunk to', chunkPath);

// 2. Prepare Modal & Responsive Script for settings.html
const modalScript = `
<!-- Add Employee Modal Dialog & Script -->
<div id="jpa_add_employee_modal" style="display:none;" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-200">
  <div class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
    <div class="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/30">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="22" x2="16" y1="11" y2="11"></line></svg>
        </div>
        <div>
          <h3 class="text-lg font-bold text-slate-900 tracking-tight">Add New Employee</h3>
          <p class="text-xs font-semibold text-slate-500">Create login credentials with instant dual Phone / Gmail access</p>
        </div>
      </div>
      <button type="button" onclick="window.__jpa_close_add_employee_modal()" class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
      </button>
    </div>

    <form id="jpa_add_employee_form" onsubmit="window.__jpa_submit_add_employee(event)" class="p-6 space-y-4 overflow-y-auto">
      <div id="jpa_add_employee_error" style="display:none;" class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700"></div>
      <div id="jpa_add_employee_success" style="display:none;" class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700"></div>

      <div>
        <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Employee Name <span class="text-rose-500">*</span></label>
        <input type="text" id="jpa_emp_name" required placeholder="e.g. Ramesh Kumar" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all">
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Contact Number (Phnumber) <span class="text-rose-500">*</span></label>
        <div class="relative flex items-center">
          <span class="absolute left-3 text-xs font-bold text-slate-400 select-none">+91</span>
          <input type="tel" id="jpa_emp_phone" required maxlength="15" placeholder="98765 43210" class="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all font-mono">
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Gmail Address <span class="text-rose-500">*</span></label>
        <input type="email" id="jpa_emp_email" required placeholder="employee@gmail.com" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all">
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Password <span class="text-rose-500">*</span></label>
        <div class="relative flex items-center">
          <input type="password" id="jpa_emp_password" required minlength="6" placeholder="Minimum 6 characters" class="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all">
          <button type="button" onclick="var p=document.getElementById('jpa_emp_password');p.type=p.type==='password'?'text':'password';" class="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Portal Role</label>
        <select id="jpa_emp_role" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all cursor-pointer">
          <option value="staff">Staff / Quotation Officer (Quotations, Catalog, AI OCR)</option>
          <option value="admin">Administrator (Full Access & Settings)</option>
        </select>
      </div>

      <div class="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <span><strong>Encrypted & Secured</strong>: Passwords are automatically encrypted with salted bcrypt hashing. The employee can sign in using <strong>either</strong> their Phone Number or Gmail.</span>
      </div>

      <div class="pt-2 flex items-center justify-end gap-3">
        <button type="button" onclick="window.__jpa_close_add_employee_modal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer">Cancel</button>
        <button type="submit" id="jpa_emp_submit_btn" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer">Save Employee</button>
      </div>
    </form>
  </div>
</div>

<script>
window.__jpa_open_add_employee_modal = function() {
  var m = document.getElementById('jpa_add_employee_modal');
  if (m) {
    m.style.display = 'flex';
    document.getElementById('jpa_add_employee_error').style.display = 'none';
    document.getElementById('jpa_add_employee_success').style.display = 'none';
    document.getElementById('jpa_emp_name').focus();
  }
};
window.__jpa_close_add_employee_modal = function() {
  var m = document.getElementById('jpa_add_employee_modal');
  if (m) m.style.display = 'none';
};
window.__jpa_submit_add_employee = async function(e) {
  e.preventDefault();
  var errEl = document.getElementById('jpa_add_employee_error');
  var succEl = document.getElementById('jpa_add_employee_success');
  var btn = document.getElementById('jpa_emp_submit_btn');
  errEl.style.display = 'none';
  succEl.style.display = 'none';
  btn.disabled = true;
  btn.innerText = 'Saving...';
  
  var name = document.getElementById('jpa_emp_name').value.trim();
  var phone = document.getElementById('jpa_emp_phone').value.trim();
  var email = document.getElementById('jpa_emp_email').value.trim();
  var password = document.getElementById('jpa_emp_password').value;
  var role = document.getElementById('jpa_emp_role').value;

  try {
    var res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, contact: phone, phnumber: phone, email: email, gmail: email, password: password, role: role })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add employee');
    succEl.innerText = data.message || 'Employee added successfully!';
    succEl.style.display = 'block';
    setTimeout(function() {
      window.__jpa_close_add_employee_modal();
      window.location.reload();
    }, 900);
  } catch (err) {
    errEl.innerText = err.message || 'Error creating employee';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerText = 'Save Employee';
  }
};
</script>
`;

// 3. Patch settings.html and settings/index.html
const patchHtml = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // Insert Add Employee button in HTML header
  const targetBtn = '<div class="flex flex-wrap items-center gap-3"><div class="px-4 py-2 rounded-xl bg-slate-100/80';
  const replacementBtn = '<div class="flex flex-wrap items-center gap-3"><button type="button" onclick="window.__jpa_open_add_employee_modal && window.__jpa_open_add_employee_modal()" class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11pt] font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all duration-150 active:scale-95 cursor-pointer select-none"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="22" x2="16" y1="11" y2="11"></line></svg><span>Add Employee</span></button><div class="px-4 py-2 rounded-xl bg-slate-100/80';

  if (html.includes(targetBtn)) {
    html = html.replace(targetBtn, replacementBtn);
  }

  // Append modal before </body>
  if (!html.includes('id="jpa_add_employee_modal"')) {
    html = html.replace('</body>', modalScript + '</body>');
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log('Successfully patched', filePath);
};

patchHtml(path.resolve('../space-deploy/settings.html'));
patchHtml(path.resolve('../space-deploy/settings/index.html'));

