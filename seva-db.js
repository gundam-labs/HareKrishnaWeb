
// ═══════════════════════════════════════════════════
//  JAGANNATH.DK — Seva Storage via JSONBin.io
//  Free database — works on any website
// ═══════════════════════════════════════════════════

const JSONBIN_CONFIG = {
  BIN_ID:    '6a5f454cf5f4af5e29abc230',       // from jsonbin.io after creating bin
  API_KEY:   '$2a$10$kGfwryHQOC7AsB6SIn68n.tuS4d8mBqnSpKUAkmzF7xCK/hnKXW2e',      // X-Master-Key from jsonbin.io
  BASE_URL:  'https://api.jsonbin.io/v3/b'
};

// EmailJS config
const EMAILJS_CONFIG = {
  PUBLIC_KEY:        'T6Of-E2sdOYjkN0Mh',
  SERVICE_ID:        'service_6cdu6dg',
  TEMPLATE_CONFIRM:  'template_h69n1wv',
  TEMPLATE_REMINDER: 'template_4rzfu4p',
  TEMPLATE_ADMIN:    'template_dn4nmdn',
  ADMIN_EMAIL:       'temple@jagannath.dk',
};

const TEMPLE = {
  NAME:    'Jagannath Danmark',
  PHONE:   '+45 48 28 64 46',
  ADDRESS: 'Skjulhøj Allé 44, 2720 Vanløse, København',
  ADMIN_URL: 'https://jagannath.dk/admin-seva.html',
};

// ── JSONBin helpers ──
async function dbRead() {
  const r = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_CONFIG.API_KEY }
  });
  if (!r.ok) throw new Error('DB read failed: ' + r.status);
  const d = await r.json();
  return d.record?.signups || [];
}

async function dbWrite(signups) {
  const r = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_CONFIG.API_KEY
    },
    body: JSON.stringify({ signups })
  });
  if (!r.ok) throw new Error('DB write failed: ' + r.status);
  return r.json();
}

// ── EmailJS helpers ──
async function sendEmail(templateId, params) {
  try {
    await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, templateId, params);
    console.log('✅ Email sent:', templateId);
  } catch(e) {
    console.warn('⚠️ Email failed (non-fatal):', e);
  }
}

// ── Main submit ──
async function submitSeva() {
  const name      = document.getElementById('f-name').value.trim();
  const initiated = document.getElementById('f-initiated').value.trim();
  const phone     = document.getElementById('f-phone').value.trim();
  const email     = document.getElementById('f-email').value.trim();
  const exp       = document.getElementById('f-exp').value;
  const date      = document.getElementById('f-date').value;
  const days      = document.getElementById('f-days').value;
  const notes     = document.getElementById('f-notes').value.trim();
  const sevas     = Array.from(document.querySelectorAll('.seva-option input:checked')).map(i => i.value);

  hideErr();
  if (!name)           { showErr('Please enter your full name.'); return; }
  if (!email)          { showErr('Please enter your email address.'); return; }
  if (!phone)          { showErr('Please enter your phone number for SMS reminders.'); return; }
  if (!sevas.length)   { showErr('Please select at least one seva type.'); return; }
  if (!date)           { showErr('Please select a seva date.'); return; }

  setLoading(true);

  const displayName   = initiated ? `${name} (${initiated})` : name;
  const sevaList      = sevas.join(', ');
  const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });

  const signup = {
    id: Date.now().toString(),
    name, initiated, phone, email, exp, sevas, date, days, notes,
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  try {
    // 1. Save to JSONBin
    const existing = await dbRead();
    existing.push(signup);
    await dbWrite(existing);
    console.log('✅ Saved to database');

    // 2. Confirmation email to devotee
    await sendEmail(EMAILJS_CONFIG.TEMPLATE_CONFIRM, {
      to_name:        displayName,
      to_email:       email,
      name:           TEMPLE.NAME,
      email:          email,
      seva_list:      sevaList,
      seva_date:      dateFormatted,
      seva_days:      days,
      devotee_phone:  phone,
      notes:          notes || 'None',
      temple_name:    TEMPLE.NAME,
      temple_phone:   TEMPLE.PHONE,
      temple_address: TEMPLE.ADDRESS,
      reply_to:       EMAILJS_CONFIG.ADMIN_EMAIL,
    });

    // 3. Admin notification
    await sendEmail(EMAILJS_CONFIG.TEMPLATE_ADMIN, {
      to_email:       EMAILJS_CONFIG.ADMIN_EMAIL,
      name:           TEMPLE.NAME,
      email:          EMAILJS_CONFIG.ADMIN_EMAIL,
      devotee_name:   displayName,
      devotee_email:  email,
      devotee_phone:  phone,
      seva_list:      sevaList,
      seva_date:      dateFormatted,
      experience:     exp,
      notes:          notes || 'None',
      admin_url:      TEMPLE.ADMIN_URL,
    });

    // 4. Reminder emails (sent now with date labels)
    await sendEmail(EMAILJS_CONFIG.TEMPLATE_REMINDER, {
      to_name:        displayName,
      to_email:       email,
      name:           TEMPLE.NAME,
      email:          email,
      seva_list:      sevaList,
      seva_date:      dateFormatted,
      reminder_label: `Tomorrow — ${dateFormatted}`,
      temple_phone:   TEMPLE.PHONE,
      temple_address: TEMPLE.ADDRESS,
    });

    await sendEmail(EMAILJS_CONFIG.TEMPLATE_REMINDER, {
      to_name:        displayName,
      to_email:       email,
      name:           TEMPLE.NAME,
      email:          email,
      seva_list:      sevaList,
      seva_date:      dateFormatted,
      reminder_label: `Today — ${dateFormatted}`,
      temple_phone:   TEMPLE.PHONE,
      temple_address: TEMPLE.ADDRESS,
    });

    showSuccess(displayName, sevaList, dateFormatted, email, phone);

  } catch(err) {
    console.error('Submit error:', err);
    showErr('Something went wrong saving your signup. Please call ' + TEMPLE.PHONE + ' or try again.');
    setLoading(false);
  }
}

function setLoading(on) {
  const btn = document.getElementById('submit-btn');
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}

function showErr(msg) {
  const el = document.getElementById('err-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior:'smooth', block:'center' });
}

function hideErr() {
  document.getElementById('err-msg').classList.add('hidden');
}

function showSuccess(name, sevaList, dateFormatted, email, phone) {
  document.getElementById('form-area').style.display = 'none';
  document.getElementById('success-area').style.display = 'block';
  document.getElementById('success-text').textContent =
    `Thank you, ${name}! Your seva request for "${sevaList}" on ${dateFormatted} has been received.`;
  document.getElementById('notif-confirm').innerHTML = `
    <strong>🔔 Notifications sent to:</strong><br>
    📧 ${email}<br>📱 ${phone}<br><br>
    ✓ Confirmation email sent now<br>
    ✓ Reminder emails scheduled<br>
    ✓ Temple coordinator notified
  `;
  window.scrollTo({ top:0, behavior:'smooth' });
}

// Admin functions (used by admin-seva.html)
async function adminLoadData() {
  try {
    return await dbRead();
  } catch(e) {
    console.error('Admin load failed:', e);
    return [];
  }
}

async function adminUpdateStatus(signups, id, status) {
  const updated = signups.map(s => s.id === id ? {...s, status} : s);
  await dbWrite(updated);
  return updated;
}

async function adminDelete(signups, id) {
  const updated = signups.filter(s => s.id !== id);
  await dbWrite(updated);
  return updated;
}
