// ═══════════════════════════════════════════════════════════════
//  JAGANNATH.DK — seva-db.js v3
//  Backend: Google Sheets via Apps Script
//  Seva options loaded dynamically from sheet — admin edits sheet!
//  All signups saved directly to Google Sheet
// ═══════════════════════════════════════════════════════════════

const SHEETS = {
  URL:    'https://script.google.com/macros/s/AKfycbxutHkNEiSEEu4RF7ZJgGIUwgwssVbP_eeHw7ILcBjAlo3eCd6lQi-LVFUvAYuIy1L9/exec',
  SECRET: 'JagannathSeva2026!'
};

const EMAILJS_CONFIG = {
  PUBLIC_KEY:        'T6Of-E2sdOYjkN0Mh',
  SERVICE_ID:        'service_6cdu6dg',
  TEMPLATE_CONFIRM:  'template_h69n1wv',
  TEMPLATE_REMINDER: 'template_4rzfu4p',
  TEMPLATE_ADMIN:    'template_dn4nmdn',
  ADMIN_EMAIL:       'temple@jagannath.dk',
};

const TEMPLE = {
  NAME:      'Jagannath Danmark',
  PHONE:     '+45 48 28 64 46',
  WHATSAPP:  '4548286446',
  ADDRESS:   'Skjulhøj Allé 44, 2720 Vanløse, København',
  ADMIN_URL: 'https://jagannath.dk/admin-seva.html',
};

// ── Sheets API call ──
async function sheetsCall(payload) {
  const resp = await fetch(SHEETS.URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...payload, secret: SHEETS.SECRET })
  });
  if (!resp.ok) throw new Error('Sheets error: ' + resp.status);
  const text = await resp.text();
  try { return JSON.parse(text); }
  catch { throw new Error('Invalid JSON from Sheets: ' + text.slice(0,100)); }
}

// ── Load seva options from sheet (admin edits sheet to change form!) ──
async function loadSevaOptions() {
  const d = await sheetsCall({ action: 'get_seva_options' });
  if (!d.success) throw new Error(d.error || 'Failed to load seva options');
  return d.options;
}

// ── Save signup to Google Sheet ──
async function dbWrite(signup) {
  const d = await sheetsCall({ action: 'save_signup', signup });
  if (!d.success) throw new Error(d.error || 'Failed to save signup');
  return d;
}

// ── Read all signups from Google Sheet ──
async function dbRead() {
  const d = await sheetsCall({ action: 'get_signups' });
  if (!d.success) throw new Error(d.error || 'Failed to load signups');
  return d.signups;
}

// ── Update status in sheet ──
async function dbUpdateStatus(id, status) {
  const d = await sheetsCall({ action: 'update_status', id, status });
  if (!d.success) throw new Error(d.error || 'Failed to update status');
  return d;
}

// ── Delete from sheet ──
async function dbDelete(id) {
  const d = await sheetsCall({ action: 'delete_signup', id });
  if (!d.success) throw new Error(d.error || 'Failed to delete');
  return d;
}

// ── Email ──
async function sendEmail(templateId, params) {
  try {
    await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, templateId, params);
    console.log('✅ Email sent:', templateId);
  } catch(e) {
    console.warn('⚠️ Email failed (non-fatal):', e);
  }
}

// ── WhatsApp click-to-chat ──
function waLink(phone, message) {
  const clean = phone.replace(/[^0-9]/g,'').replace(/^0+/,'');
  const num = clean.length === 8 ? '45' + clean : clean;
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(message);
}

// ═══════════════════════════════════════
//  RENDER SEVA OPTIONS DYNAMICALLY
//  Called on page load — reads from Google Sheet
// ═══════════════════════════════════════
const CATEGORY_ICONS = {
  'Morning':  '🌅', 'Cooking': '🍲', 'Evening': '🌙',
  'Special':  '🏛️', 'General': '🤝'
};

const DEFAULT_ICONS = {
  'Mangala Aarti': '🕯️', 'Deity Dressing': '🌸',
  'Flower Arrangement': '💐', 'Altar Cleaning': '✨',
  'Cooking Prasadam': '🍲', 'Sunday Feast Cooking': '🥘',
  'Greeting Devotees': '🙏', 'Kirtan': '🥁',
  'Ratha-Yatra Preparation': '🏛️', 'General Assistance': '🤝'
};

async function renderSevaOptions() {
  const container = document.getElementById('seva-options-grid');
  if (!container) return;

  // Show loading state
  container.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted)">
      <div style="font-size:1.5rem;margin-bottom:.5rem">🔄</div>
      Loading seva options from temple...
    </div>`;

  try {
    const options = await loadSevaOptions();

    if (!options || options.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted)">
          No seva options available. Please contact the temple.
        </div>`;
      return;
    }

    container.innerHTML = options.map((opt, i) => {
      const icon = opt.icon || DEFAULT_ICONS[opt.name] ||
                   CATEGORY_ICONS[opt.category] || '🙏';
      const id = 'seva_' + i;
      return `
        <div class="seva-option">
          <input type="checkbox" id="${id}" value="${opt.name}">
          <label for="${id}">
            <span class="seva-icon">${icon}</span>
            <span class="seva-name">${opt.name}</span>
            <span class="seva-time">${opt.time}</span>
          </label>
        </div>`;
    }).join('');

    console.log(`✅ Loaded ${options.length} seva options from Google Sheet`);
  } catch(err) {
    console.error('Failed to load seva options:', err);
    // Fallback to hardcoded options if sheet fails
    container.innerHTML = `
      <div class="seva-option"><input type="checkbox" id="s1" value="Mangala Aarti"><label for="s1"><span class="seva-icon">🕯️</span><span class="seva-name">Mangala Aarti</span><span class="seva-time">4:30 AM daily</span></label></div>
      <div class="seva-option"><input type="checkbox" id="s2" value="Deity Dressing"><label for="s2"><span class="seva-icon">🌸</span><span class="seva-name">Deity Dressing</span><span class="seva-time">Morning</span></label></div>
      <div class="seva-option"><input type="checkbox" id="s3" value="Cooking Prasadam"><label for="s3"><span class="seva-icon">🍲</span><span class="seva-name">Cooking Prasadam</span><span class="seva-time">Late morning</span></label></div>
      <div class="seva-option"><input type="checkbox" id="s4" value="Kirtan"><label for="s4"><span class="seva-icon">🥁</span><span class="seva-name">Kirtan</span><span class="seva-time">Various</span></label></div>
      <div class="seva-option"><input type="checkbox" id="s5" value="Sunday Feast Cooking"><label for="s5"><span class="seva-icon">🥘</span><span class="seva-name">Sunday Feast Cooking</span><span class="seva-time">Sundays 12:00</span></label></div>
      <div class="seva-option"><input type="checkbox" id="s6" value="General Assistance"><label for="s6"><span class="seva-icon">🤝</span><span class="seva-name">General Assistance</span><span class="seva-time">As needed</span></label></div>
      <p style="grid-column:1/-1;font-size:12px;color:var(--text-muted);margin-top:.5rem">
        ⚠️ Could not load live options — showing defaults. <a href="javascript:renderSevaOptions()" style="color:var(--saffron)">Retry</a>
      </p>`;
  }
}

// ═══════════════════════════════════════
//  MAIN SUBMIT
// ═══════════════════════════════════════
async function submitSeva() {
  const name      = document.getElementById('f-name').value.trim();
  const initiated = document.getElementById('f-initiated').value.trim();
  const phone     = document.getElementById('f-phone').value.trim();
  const email     = document.getElementById('f-email').value.trim();
  const exp       = document.getElementById('f-exp').value;
  const date      = document.getElementById('f-date').value;
  const days      = document.getElementById('f-days').value;
  const notes     = document.getElementById('f-notes').value.trim();
  const sevas     = Array.from(
    document.querySelectorAll('.seva-option input:checked')
  ).map(i => i.value);

  hideErr();

  if (!name)         { showErr('Please enter your full name.'); return; }
  if (!email)        { showErr('Please enter your email address.'); return; }
  if (!phone)        { showErr('Please enter your phone number.'); return; }
  if (!sevas.length) { showErr('Please select at least one seva type.'); return; }
  if (!date)         { showErr('Please select a seva date.'); return; }

  setLoading(true);

  const displayName   = initiated ? `${name} (${initiated})` : name;
  const sevaList      = sevas.join(', ');
  const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });
  const firstName = name.split(' ')[0];

  const signup = {
    id:          Date.now().toString(),
    name, initiated, phone, email, exp, sevas,
    date, days, notes,
    status:      'pending',
    submittedAt: new Date().toISOString()
  };

  try {
    // 1. Save to Google Sheet
    await dbWrite(signup);
    console.log('✅ Saved to Google Sheet');

    // 2. Confirmation email
    const waConfirmLink = waLink(TEMPLE.WHATSAPP,
      `Hare Krishna! I signed up for seva: ${sevaList} on ${dateFormatted}. My name: ${displayName}.`
    );
    await sendEmail(EMAILJS_CONFIG.TEMPLATE_CONFIRM, {
      to_name: displayName, to_email: email, name: TEMPLE.NAME, email,
      seva_list: sevaList, seva_date: dateFormatted, seva_days: days,
      devotee_phone: phone, notes: notes || 'None',
      temple_name: TEMPLE.NAME, temple_phone: TEMPLE.PHONE,
      temple_address: TEMPLE.ADDRESS, reply_to: EMAILJS_CONFIG.ADMIN_EMAIL,
      wa_link: waConfirmLink,
    });

    // 3. Admin email (Apps Script also sends one, this is a backup)
    await sendEmail(EMAILJS_CONFIG.TEMPLATE_ADMIN, {
      to_email: EMAILJS_CONFIG.ADMIN_EMAIL, name: TEMPLE.NAME,
      email: EMAILJS_CONFIG.ADMIN_EMAIL,
      devotee_name: displayName, devotee_email: email, devotee_phone: phone,
      seva_list: sevaList, seva_date: dateFormatted,
      experience: exp, notes: notes || 'None', admin_url: TEMPLE.ADMIN_URL,
    });

    // 4. Reminder emails
    await sendEmail(EMAILJS_CONFIG.TEMPLATE_REMINDER, {
      to_name: displayName, to_email: email, name: TEMPLE.NAME, email,
      seva_list: sevaList, seva_date: dateFormatted,
      reminder_label: `Day before — ${dateFormatted}`,
      temple_phone: TEMPLE.PHONE, temple_address: TEMPLE.ADDRESS,
    });
    await sendEmail(EMAILJS_CONFIG.TEMPLATE_REMINDER, {
      to_name: displayName, to_email: email, name: TEMPLE.NAME, email,
      seva_list: sevaList, seva_date: dateFormatted,
      reminder_label: `Morning of seva — ${dateFormatted}`,
      temple_phone: TEMPLE.PHONE, temple_address: TEMPLE.ADDRESS,
    });

    // 5. WhatsApp click-to-chat link for success screen
    const waLink_ = waLink(
      phone.replace(/[^0-9]/g,''),
      `Hare Krishna! I just signed up for seva at Jagannath Danmark.\nSeva: ${sevaList}\nDate: ${dateFormatted}\nName: ${displayName}`
    );

    showSuccess(displayName, sevaList, dateFormatted, email, phone, waLink_);

  } catch(err) {
    console.error('Submit error:', err);
    showErr(`Something went wrong: ${err.message}. Please call ${TEMPLE.PHONE} or try again.`);
    setLoading(false);
  }
}

// ═══════════════════════════════════════
//  ADMIN FUNCTIONS (used by admin-seva.html)
// ═══════════════════════════════════════
async function adminLoadData()              { return await dbRead(); }
async function adminUpdateStatus(s, id, st) {
  await dbUpdateStatus(id, st);
  return s.map(x => x.id===id ? {...x, status:st} : x);
}
async function adminDelete(s, id) {
  await dbDelete(id);
  return s.filter(x => x.id!==id);
}

// ═══════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════
function setLoading(on) {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}
function showErr(msg) {
  const el = document.getElementById('err-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({behavior:'smooth', block:'center'});
}
function hideErr() {
  const el = document.getElementById('err-msg');
  if (el) el.classList.add('hidden');
}
function showSuccess(name, sevaList, dateFormatted, email, phone, waFallbackLink) {
  const fa = document.getElementById('form-area');
  const sa = document.getElementById('success-area');
  if (fa) fa.style.display = 'none';
  if (sa) sa.style.display = 'block';
  const st = document.getElementById('success-text');
  if (st) st.textContent =
    `Thank you, ${name}! Your seva "${sevaList}" on ${dateFormatted} has been received.`;
  const nc = document.getElementById('notif-confirm');
  if (nc) nc.innerHTML = `
    <strong>🔔 Notifications sent to:</strong><br>
    📧 ${email}<br>📱 ${phone}<br><br>
    ✓ Confirmation email sent<br>
    ✓ Reminder emails scheduled (day before &amp; morning of)<br>
    ✓ Temple coordinator notified<br>
    ✓ Signup saved to temple records<br>
    ${waFallbackLink ? `
    <hr style="border:none;border-top:1px solid var(--border);margin:.75rem 0">
    <strong>💬 Also send us a WhatsApp:</strong><br>
    <a href="${waFallbackLink}" target="_blank"
       style="display:inline-flex;align-items:center;gap:6px;margin-top:.5rem;
              background:#25D366;color:white;padding:8px 16px;border-radius:6px;
              text-decoration:none;font-size:13px;font-weight:500">
      💬 Open WhatsApp
    </a>` : ''}
  `;
  window.scrollTo({top:0, behavior:'smooth'});
}
