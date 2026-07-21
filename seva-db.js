// ═══════════════════════════════════════════════════════════════
//  JAGANNATH.DK — seva-db.js  (Step 1: JSONBin direct)
//  SMS via Cloudflare Worker — added in Step 2
// ═══════════════════════════════════════════════════════════════

const JSONBIN = {
  BIN_ID:  '6a5f454cf5f4af5e29abc230',
  API_KEY: '$2a$10$zNYsukts2VZ1jQDVoRzvXOv/v.pCyLaNrLg7OKncO.WL56iYn.WNa',
  URL:     'https://api.jsonbin.io/v3/b'
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
  ADDRESS:   'Skjulhøj Allé 44, 2720 Vanløse, København',
  ADMIN_URL: 'https://jagannath.dk/admin-seva.html',
};

// ── Database ──
async function dbRead() {
  const r = await fetch(`${JSONBIN.URL}/${JSONBIN.BIN_ID}/latest`, {
    headers: { 'X-Master-Key': JSONBIN.API_KEY }
  });
  if (!r.ok) throw new Error('DB read failed: ' + r.status);
  const d = await r.json();
  return d.record?.signups || [];
}

async function dbWrite(signups) {
  const r = await fetch(`${JSONBIN.URL}/${JSONBIN.BIN_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN.API_KEY
    },
    body: JSON.stringify({ signups })
  });
  if (!r.ok) throw new Error('DB write failed: ' + r.status);
  return r.json();
}

// ── Email ──
async function sendEmail(templateId, params) {
  try {
    await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, templateId, params);
    console.log('✅ Email sent:', templateId);
  } catch(e) {
    console.warn('⚠️ Email failed:', e);
  }
}

// ── SMS (Step 2 — Cloudflare Worker, skip for now) ──
async function sendSMS(to, message) {
  console.log('ℹ️ SMS not yet configured — Step 2');
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
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const signup = {
    id: Date.now().toString(),
    name, initiated, phone, email, exp, sevas,
    date, days, notes,
    status:      'pending',
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
      to_email:      EMAILJS_CONFIG.ADMIN_EMAIL,
      name:          TEMPLE.NAME,
      email:         EMAILJS_CONFIG.ADMIN_EMAIL,
      devotee_name:  displayName,
      devotee_email: email,
      devotee_phone: phone,
      seva_list:     sevaList,
      seva_date:     dateFormatted,
      experience:    exp,
      notes:         notes || 'None',
      admin_url:     TEMPLE.ADMIN_URL,
    });

    // 4. Reminder emails
    await sendEmail(EMAILJS_CONFIG.TEMPLATE_REMINDER, {
      to_name:        displayName,
      to_email:       email,
      name:           TEMPLE.NAME,
      email:          email,
      seva_list:      sevaList,
      seva_date:      dateFormatted,
      reminder_label: `Day before — ${dateFormatted}`,
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
      reminder_label: `Morning of seva — ${dateFormatted}`,
      temple_phone:   TEMPLE.PHONE,
      temple_address: TEMPLE.ADDRESS,
    });

    showSuccess(displayName, sevaList, dateFormatted, email, phone);

  } catch(err) {
    console.error('Submit error:', err);
    showErr(`Something went wrong: ${err.message}. Please call ${TEMPLE.PHONE} or try again.`);
    setLoading(false);
  }
}

// ── Admin functions ──
async function adminLoadData()               { return await dbRead(); }
async function adminUpdateStatus(s, id, st)  {
  const u = s.map(x => x.id===id ? {...x, status:st} : x);
  await dbWrite(u); return u;
}
async function adminDelete(s, id) {
  const u = s.filter(x => x.id!==id);
  await dbWrite(u); return u;
}

// ── UI helpers ──
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
function showSuccess(name, sevaList, dateFormatted, email, phone) {
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
    ✓ Reminder emails sent<br>
    ✓ Temple coordinator notified
  `;
  window.scrollTo({top:0, behavior:'smooth'});
}
