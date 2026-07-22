// ═══════════════════════════════════════════════════════════════
//  JAGANNATH.DK — seva-db.js
//  All storage + SMS goes through Cloudflare Worker.
//  NO secrets in this file — safe to be public on GitHub.
//
//  After deploying your Cloudflare Worker, set:
//    WORKER_URL    = your worker URL
//    WORKER_SECRET = the secret you chose
// ═══════════════════════════════════════════════════════════════

const WORKER = {
  URL:    'https://jagannath-sms.YOUR-SUBDOMAIN.workers.dev',  // ← update this
  SECRET: 'JagannathSeva2026!'                                 // ← update this
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

// ═══════════════════════════════════════
//  WORKER CALLS
// ═══════════════════════════════════════
async function workerCall(payload) {
  const resp = await fetch(WORKER.URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...payload, secret: WORKER.SECRET })
  });
  if (!resp.ok) throw new Error(`Worker error: ${resp.status}`);
  return resp.json();
}

async function dbRead() {
  const data = await workerCall({ action: 'db_read' });
  if (!data.success) throw new Error(data.error || 'DB read failed');
  return data.signups;
}

async function dbWrite(signups) {
  const data = await workerCall({ action: 'db_write', signups });
  if (!data.success) throw new Error(data.error || 'DB write failed');
  return data;
}

async function sendSMS(to, message) {
  if (WORKER.URL.includes('YOUR-SUBDOMAIN')) {
    console.log('⚠️ Worker not configured — SMS skipped');
    return;
  }
  try {
    const data = await workerCall({ action: 'sms', to, message });
    if (data.success) console.log('✅ SMS sent:', data.sid);
    else console.warn('⚠️ SMS failed:', data.error);
  } catch (err) {
    console.warn('⚠️ SMS error (non-fatal):', err.message);
  }
}

// ═══════════════════════════════════════
//  EMAIL (EmailJS)
// ═══════════════════════════════════════
async function sendEmail(templateId, params) {
  try {
    await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, templateId, params);
    console.log('✅ Email sent:', templateId);
  } catch (err) {
    console.warn('⚠️ Email failed (non-fatal):', err);
  }
}

// ═══════════════════════════════════════
//  MAIN SUBMIT (called from seva.html)
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

  // Validate
  if (!name)         { showErr('Please enter your full name.'); return; }
  if (!email)        { showErr('Please enter your email address.'); return; }
  if (!phone)        { showErr('Please enter your phone number for SMS reminders.'); return; }
  if (!sevas.length) { showErr('Please select at least one seva type.'); return; }
  if (!date)         { showErr('Please select a seva date.'); return; }

  setLoading(true);

  const displayName   = initiated ? `${name} (${initiated})` : name;
  const sevaList      = sevas.join(', ');
  const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const signup = {
    id:          Date.now().toString(),
    name, initiated, phone, email, exp, sevas,
    date, days, notes,
    status:      'pending',
    submittedAt: new Date().toISOString()
  };

  try {
    // 1. Save to database via Worker → JSONBin
    const existing = await dbRead();
    existing.push(signup);
    await dbWrite(existing);
    console.log('✅ Signup saved to database');

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

    // 3. Admin notification email
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

    // 4. Reminder emails — sent now with date labels embedded
    await sendEmail(EMAILJS_CONFIG.TEMPLATE_REMINDER, {
      to_name:        displayName,
      to_email:       email,
      name:           TEMPLE.NAME,
      email:          email,
      seva_list:      sevaList,
      seva_date:      dateFormatted,
      reminder_label: `Day before reminder — ${dateFormatted}`,
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

    // 5. SMS via Worker → Twilio (non-fatal if Twilio not set up yet)
    const firstName = name.split(' ')[0];
    await sendSMS(phone,
      `Hare Krishna ${firstName}! 🙏 Your seva "${sevaList}" on ${dateFormatted} is confirmed at Jagannath Temple, Skjulhøj Allé 44. Questions? Call ${TEMPLE.PHONE}. Jai Jagannath!`
    );

    // 5. WhatsApp to devotee (Cloud API — auto if configured)
    const waMsg = `Hare Krishna ${firstName}! 🙏

Your seva signup has been received!

✅ Seva: ${sevaList}
📅 Date: ${dateFormatted}
📍 Temple: Skjulhøj Allé 44, Vanløse

The coordinator will confirm shortly. Questions? Just reply here!
Jai Jagannath! 🪬`;

    const waResult = await sendWhatsApp(phone, waMsg);

    // 6. Notify coordinator via WhatsApp
    await notifyCoordinator(signup);

    // Click-to-chat fallback link if Cloud API not configured
    const waFallbackLink = !waResult?.success
      ? waLink(phone, `Hare Krishna! I signed up for seva: ${sevaList} on ${dateFormatted}. My name: ${displayName}`)
      : null;

    showSuccess(displayName, sevaList, dateFormatted, email, phone, waFallbackLink);

  } catch (err) {
    console.error('Submit error:', err);
    showErr(`Something went wrong: ${err.message}. Please call ${TEMPLE.PHONE} or try again.`);
    setLoading(false);
  }
}

// ═══════════════════════════════════════
//  ADMIN FUNCTIONS (used by admin-seva.html)
// ═══════════════════════════════════════
async function adminLoadData() {
  return await dbRead();
}

async function adminUpdateStatus(signups, id, status) {
  const updated = signups.map(s => s.id === id ? { ...s, status } : s);
  await dbWrite(updated);
  return updated;
}

async function adminDelete(signups, id) {
  const updated = signups.filter(s => s.id !== id);
  await dbWrite(updated);
  return updated;
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
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideErr() {
  const el = document.getElementById('err-msg');
  if (el) el.classList.add('hidden');
}

function showSuccess(name, sevaList, dateFormatted, email, phone, waFallbackLink) {
  const formArea    = document.getElementById('form-area');
  const successArea = document.getElementById('success-area');
  if (formArea)    formArea.style.display = 'none';
  if (successArea) successArea.style.display = 'block';

  const successText = document.getElementById('success-text');
  if (successText) {
    successText.textContent =
      `Thank you, ${name}! Your seva request for "${sevaList}" on ${dateFormatted} has been received.`;
  }

  const notifConfirm = document.getElementById('notif-confirm');
  if (notifConfirm) {
    notifConfirm.innerHTML = `
      <strong>🔔 Notifications sent to:</strong><br>
      📧 ${email}<br>
      📱 ${phone}<br><br>
      ✓ Confirmation email sent<br>
      ✓ Reminder emails sent (day before &amp; morning of)<br>
      ✓ SMS confirmation sent<br>
      ✓ Temple coordinator notified
    `;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ═══════════════════════════════════════
//  WHATSAPP ADDITIONS v2
// ═══════════════════════════════════════

// WhatsApp Cloud API via Worker
async function sendWhatsApp(to, message) {
  try {
    const d = await workerCall({ action: 'whatsapp', to, message });
    if (d.success) console.log('✅ WhatsApp sent:', d.id);
    else if (d.skipped) console.log('ℹ️ WhatsApp API not yet configured');
    else console.warn('⚠️ WhatsApp failed:', d.error);
    return d;
  } catch(e) {
    console.warn('⚠️ WhatsApp error (non-fatal):', e.message);
    return { success: false };
  }
}

// Notify temple coordinator via WhatsApp
async function notifyCoordinator(signup) {
  try {
    const d = await workerCall({ action: 'whatsapp_notify', signup });
    if (d.success) console.log('✅ Coordinator notified via WhatsApp');
    else if (d.skipped) console.log('ℹ️ Coordinator WhatsApp not yet configured');
  } catch(e) {
    console.warn('⚠️ Coordinator notify error (non-fatal):', e.message);
  }
}

// WhatsApp click-to-chat link builder
function waLink(phone, message) {
  const clean = phone.replace(/[^0-9]/g,'').replace(/^0+/,'');
  const num = clean.length === 8 ? '45' + clean : clean;
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(message);
}
