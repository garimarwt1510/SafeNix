/* ============================================================
   SAFENIX – RAPID CRISIS RESPONSE SYSTEM  |  script.js
   Features: SOS, Women SOS, AI Guidance, Geolocation,
   Audio Recording, Fake Call, Voice SOS, Timer, Dark Mode,
   Contacts, Profile, Live Tracking, AI Chat
   ============================================================ */

'use strict';

/* ── Active Nav Link ── */
(function () {
  const cur = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(l => {
    if (l.getAttribute('href') === cur || (cur === '' && l.getAttribute('href') === 'index.html'))
      l.classList.add('active');
  });
})();

/* ── Mobile Nav ── */
const $navToggle = document.getElementById('nav-toggle');
const $navLinks  = document.getElementById('nav-links');
if ($navToggle && $navLinks) {
  $navToggle.addEventListener('click', () => {
    $navLinks.classList.toggle('open');
    $navToggle.classList.toggle('open');
  });
  $navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => $navLinks.classList.remove('open')));
}

/* ── Dark Mode ── */
const $darkBtn = document.getElementById('dark-btn');
function applyDark(on) {
  document.body.classList.toggle('dark', on);
  if ($darkBtn) $darkBtn.innerHTML = on ? '☀️ Light' : '🌙 Dark';
  localStorage.setItem('snx_dark', on ? '1' : '0');
}
applyDark(localStorage.getItem('snx_dark') === '1');
if ($darkBtn) $darkBtn.addEventListener('click', () => applyDark(!document.body.classList.contains('dark')));

/* ── Toast ── */
function toast(msg, type = '', dur = 3500) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = `toast${type ? ' ' + type : ''}`;
  const icon = { success:'✓', error:'✕', warning:'⚠' }[type] || 'ℹ';
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, dur);
}

/* ── Geolocation ── */
function getPos() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) { rej(new Error('Geolocation not supported')); return; }
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  });
}

/* ── Storage ── */
function getContacts() { try { return JSON.parse(localStorage.getItem('snx_contacts') || '[]'); } catch { return []; } }
function setContacts(c) { localStorage.setItem('snx_contacts', JSON.stringify(c)); }
function getProfile()  { try { return JSON.parse(localStorage.getItem('snx_profile')  || '{}'); } catch { return {}; } }
function setProfile(p) { localStorage.setItem('snx_profile', JSON.stringify(p)); }

/* ── Markdown renderer (bold + numbered list) ── */
function md(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ol style="margin:.35rem 0 0 1.1rem;padding:0">${m}</ol>`)
    .replace(/\n/g, '<br>');
}

/* ── Claude AI helper ── */
async function askAI(userMsg, system, maxTokens = 220) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMsg }]
      })
    });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    return d.content?.[0]?.text || null;
  } catch { return null; }
}

const SYS_SOS = `You are Safenix's Emergency AI. Give 4-5 urgent numbered steps the user must take RIGHT NOW. Use **bold** for the single most critical action. Under 120 words. End: "Call 112 now."`;
const SYS_WOMEN = `You are Safenix's Women Safety AI. The user feels unsafe. Give 4-5 urgent practical numbered steps to stay safe immediately. Use **bold** for the most important action. Mention 1091 (Women Helpline) or 100 (Police). Under 120 words. Be calm and clear.`;

/* ── Audio Recording ── */
let _rec = null, _chunks = [];
async function startRec() {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    _chunks = [];
    _rec = new MediaRecorder(s);
    _rec.ondataavailable = e => { if (e.data.size > 0) _chunks.push(e.data); };
    _rec.onstop = () => s.getTracks().forEach(t => t.stop());
    _rec.start();
  } catch { /* mic not available */ }
}
function stopRec() {
  if (_rec && _rec.state !== 'inactive') _rec.stop();
  _rec = null;
}

/* ── Notify contacts ── */
function notifyContacts(type = 'SOS') {
  const c = getContacts();
  if (!c.length) return;
  const names = c.slice(0, 2).map(x => x.name).join(', ');
  toast(`${type} alert sent to: ${names}${c.length > 2 ? ' + others' : ''}`, 'success', 5000);
}

/* ══════════════════════════════════════════════════════════
   SOS BUTTON  (index.html + any page with #sos-btn)
══════════════════════════════════════════════════════════ */
const $sosBtn  = document.getElementById('sos-btn');
const $sosOver = document.getElementById('sos-overlay');
const $sosClose= document.getElementById('sos-close');
const $sosLoc  = document.getElementById('sos-location');
const $sosMap  = document.getElementById('sos-map-link');
const $sosAI   = document.getElementById('sos-ai-panel');
const $sosAITx = document.getElementById('sos-ai-text');
const $sosSuc  = document.getElementById('sos-success');
const $recBadge= document.getElementById('rec-badge');

if ($sosBtn) {
  $sosBtn.addEventListener('click', async () => {
    $sosBtn.classList.add('btn-fired');
    $sosBtn.disabled = true;
    setTimeout(() => { $sosBtn.classList.remove('btn-fired'); $sosBtn.disabled = false; }, 800);

    if ($sosOver) $sosOver.classList.add('active');
    if ($recBadge) $recBadge.classList.add('on');
    if ($sosAI)  $sosAI.style.display = 'none';
    if ($sosSuc) $sosSuc.classList.remove('show');
    if ($sosLoc) $sosLoc.textContent = '📡 Fetching location…';
    if ($sosMap) $sosMap.style.display = 'none';

    startRec();

    let locStr = 'Unknown';
    try {
      const pos = await getPos();
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const url = `https://www.google.com/maps?q=${lat},${lng}`;
      locStr = `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
      if ($sosLoc) $sosLoc.innerHTML = `📍 <b>Lat:</b> ${lat.toFixed(6)}<br>📍 <b>Lng:</b> ${lng.toFixed(6)}<br>🎯 <b>Accuracy:</b> ±${Math.round(accuracy)}m<br>🗺️ <a href="${url}" target="_blank" style="color:var(--sea)">Open in Google Maps ↗</a>`;
      if ($sosMap) { $sosMap.href = url; $sosMap.style.display = 'inline-flex'; }
      notifyContacts('🆘 SOS');
    } catch { if ($sosLoc) $sosLoc.textContent = '⚠️ Location unavailable — enable GPS.'; }

    setTimeout(() => { if ($sosSuc) $sosSuc.classList.add('show'); }, 400);

    if ($sosAI && $sosAITx) {
      $sosAI.style.display = 'block';
      $sosAITx.innerHTML = '<span style="color:var(--muted);font-size:.82rem">🤖 Getting AI emergency guidance…</span>';
      const advice = await askAI(`SOS triggered. User location: ${locStr}. What should they do right now?`, SYS_SOS);
      $sosAITx.innerHTML = advice ? md(advice) : '<ol style="margin:.35rem 0 0 1.1rem"><li><strong>Call 112 immediately</strong></li><li>Stay calm and stay on the line</li><li>Share your exact location with the dispatcher</li><li>Alert nearby people for help</li></ol>';
    }
  });
}
if ($sosClose) $sosClose.addEventListener('click', () => { $sosOver?.classList.remove('active'); stopRec(); if ($recBadge) $recBadge.classList.remove('on'); });
if ($sosOver)  $sosOver.addEventListener('click',  e => { if (e.target === $sosOver) { $sosOver.classList.remove('active'); stopRec(); if ($recBadge) $recBadge.classList.remove('on'); } });

/* ══════════════════════════════════════════════════════════
   WOMEN SOS  (index.html + safety.html)
══════════════════════════════════════════════════════════ */
const $wBtn   = document.getElementById('women-btn');
const $wOver  = document.getElementById('women-overlay');
const $wClose = document.getElementById('women-close');
const $wLoc   = document.getElementById('women-location');
const $wMap   = document.getElementById('women-map-link');
const $wAI    = document.getElementById('women-ai-panel');
const $wAITx  = document.getElementById('women-ai-text');
const $wSuc   = document.getElementById('women-success');

async function triggerWomenSOS() {
  if ($wOver) $wOver.classList.add('active');
  if ($wAI)  $wAI.style.display = 'none';
  if ($wSuc) $wSuc.classList.remove('show');
  if ($wLoc) $wLoc.textContent = '📡 Fetching location…';
  if ($wMap) $wMap.style.display = 'none';

  startRec();

  let locStr = 'Unknown';
  try {
    const pos = await getPos();
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    locStr = `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
    if ($wLoc) $wLoc.innerHTML = `📍 <b>Lat:</b> ${lat.toFixed(6)}<br>📍 <b>Lng:</b> ${lng.toFixed(6)}<br>🎯 <b>Accuracy:</b> ±${Math.round(accuracy)}m<br>🗺️ <a href="${url}" target="_blank" style="color:var(--sea)">Open in Google Maps ↗</a>`;
    if ($wMap) { $wMap.href = url; $wMap.style.display = 'inline-flex'; }
    notifyContacts('🚺 Women Safety');
  } catch { if ($wLoc) $wLoc.textContent = '⚠️ Location unavailable — enable GPS.'; }

  setTimeout(() => { if ($wSuc) $wSuc.classList.add('show'); }, 400);

  if ($wAI && $wAITx) {
    $wAI.style.display = 'block';
    $wAITx.innerHTML = '<span style="color:var(--muted);font-size:.82rem">🤖 Getting AI safety guidance…</span>';
    const advice = await askAI(`I feel unsafe. My location: ${locStr}. What should I do right now?`, SYS_WOMEN);
    $wAITx.innerHTML = advice ? md(advice) : '<ol style="margin:.35rem 0 0 1.1rem"><li><strong>Call 1091 (Women Helpline) or 100 (Police) now</strong></li><li>Move to a crowded, well-lit area immediately</li><li>Share your live location with a trusted contact</li><li>Stay on the phone with someone you trust</li><li>Make noise if in immediate danger</li></ol>';
  }
}

if ($wBtn) {
  $wBtn.addEventListener('click', () => {
    $wBtn.classList.add('btn-fired'); $wBtn.disabled = true;
    setTimeout(() => { $wBtn.classList.remove('btn-fired'); $wBtn.disabled = false; }, 800);
    triggerWomenSOS();
  });
}
if ($wClose) $wClose.addEventListener('click', () => { $wOver?.classList.remove('active'); stopRec(); });
if ($wOver)  $wOver.addEventListener('click',  e => { if (e.target === $wOver) { $wOver.classList.remove('active'); stopRec(); } });

/* ══════════════════════════════════════════════════════════
   LIVE LOCATION TRACKING  (safety.html, location.html)
══════════════════════════════════════════════════════════ */
let _watchId = null;
const $liveStart = document.getElementById('live-start-btn');
const $liveStop  = document.getElementById('live-stop-btn');
const $liveCoords= document.getElementById('live-coords');
const $liveMap   = document.getElementById('live-map-link');
const $liveStat  = document.getElementById('live-status');

if ($liveStart) $liveStart.addEventListener('click', () => {
  if (!navigator.geolocation) { toast('Geolocation not supported', 'error'); return; }
  $liveStart.disabled = true;
  if ($liveStop) $liveStop.disabled = false;
  if ($liveStat) $liveStat.textContent = '🟢 Tracking active…';
  toast('Live tracking started', 'success');
  _watchId = navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    if ($liveCoords) $liveCoords.innerHTML = `<strong>${lat.toFixed(6)}, ${lng.toFixed(6)}</strong><br><small style="color:var(--muted)">±${Math.round(accuracy)}m • ${new Date().toLocaleTimeString()}</small>`;
    if ($liveMap) { $liveMap.href = url; $liveMap.style.display = 'inline-flex'; }
  }, () => { if ($liveStat) $liveStat.textContent = '⚠️ Location error'; }, { enableHighAccuracy: true, maximumAge: 3000 });
});

if ($liveStop) $liveStop.addEventListener('click', () => {
  if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
  $liveStop.disabled = true;
  if ($liveStart) $liveStart.disabled = false;
  if ($liveStat) $liveStat.textContent = '⚫ Tracking stopped';
});

/* ══════════════════════════════════════════════════════════
   AUDIO RECORDING CARD  (safety.html)
══════════════════════════════════════════════════════════ */
const $audStart = document.getElementById('audio-start-btn');
const $audStop  = document.getElementById('audio-stop-btn');
const $audWave  = document.getElementById('audio-wave');
const $audStat  = document.getElementById('audio-status');

if ($audStart) $audStart.addEventListener('click', async () => {
  try {
    await startRec();
    $audStart.disabled = true;
    if ($audStop) $audStop.disabled = false;
    if ($audWave) $audWave.classList.add('on');
    if ($audStat) $audStat.textContent = '🔴 Recording in progress…';
    toast('Audio recording started', 'success');
  } catch { toast('Microphone access denied', 'error'); }
});
if ($audStop) $audStop.addEventListener('click', () => {
  stopRec();
  $audStop.disabled = true;
  if ($audStart) $audStart.disabled = false;
  if ($audWave) $audWave.classList.remove('on');
  if ($audStat) $audStat.textContent = '⚫ Recording stopped — evidence saved locally';
  toast('Recording saved', 'success');
});

/* ══════════════════════════════════════════════════════════
   FAKE CALL  (safety.html)
══════════════════════════════════════════════════════════ */
const $fakeCallBtn = document.getElementById('fake-call-btn');
const $fakeScreen  = document.getElementById('fake-call-screen');
const $fcDecline   = document.getElementById('fc-decline');
const $fcAccept    = document.getElementById('fc-accept');
const $fcName      = document.getElementById('fc-name');
const $fcNumber    = document.getElementById('fc-number');
const $fcInput     = document.getElementById('fc-name-input');

const FAKE_CALLERS = [
  { name:'Mom Calling',      num:'+91 98765 00001' },
  { name:'Dad Calling',      num:'+91 98765 00002' },
  { name:'Priya (Sister)',   num:'+91 87654 00003' },
  { name:'Ravi (Friend)',    num:'+91 76543 00004' },
  { name:'Home',             num:'+91 11 2345 6789' },
];

if ($fakeCallBtn) $fakeCallBtn.addEventListener('click', () => {
  const custom = $fcInput?.value.trim();
  const caller = custom
    ? { name: custom + ' Calling', num: '+91 00000 00000' }
    : FAKE_CALLERS[Math.floor(Math.random() * FAKE_CALLERS.length)];
  if ($fcName)   $fcName.textContent   = caller.name;
  if ($fcNumber) $fcNumber.textContent = caller.num;
  if ($fakeScreen) $fakeScreen.classList.add('active');
});
[$fcDecline, $fcAccept].forEach(b => { if (b) b.addEventListener('click', () => $fakeScreen?.classList.remove('active')); });

/* ══════════════════════════════════════════════════════════
   QUICK ALERT TEMPLATES  (safety.html)
══════════════════════════════════════════════════════════ */
document.querySelectorAll('.tpl-btn').forEach(btn => {
  btn.dataset.orig = btn.textContent;
  btn.addEventListener('click', function () {
    const contacts = getContacts();
    if (!contacts.length) { toast('Add emergency contacts first!', 'warning'); return; }
    const msg = this.dataset.msg;
    toast(`"${msg.slice(0, 30)}…" sent to ${contacts.length} contact${contacts.length > 1 ? 's' : ''}!`, 'success', 4000);
    this.classList.add('sent');
    this.textContent = '✓ Sent!';
    setTimeout(() => { this.classList.remove('sent'); this.textContent = this.dataset.orig; }, 3000);
  });
});

/* ══════════════════════════════════════════════════════════
   VOICE SOS  (safety.html)
══════════════════════════════════════════════════════════ */
const $voiceCard= document.getElementById('voice-sos-card');
const $voiceBtn = document.getElementById('voice-sos-btn');
const $voiceStat= document.getElementById('voice-status');
const $voiceWave= document.getElementById('voice-wave');
let _voiceOn = false;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

if ($voiceBtn) $voiceBtn.addEventListener('click', () => {
  if (!_voiceOn) {
    _voiceOn = true;
    if ($voiceCard) $voiceCard.classList.add('listening');
    if ($voiceStat) $voiceStat.textContent = '🎤 Listening for "HELP" or "SOS"…';
    $voiceBtn.textContent = '⏹ Stop Listening';
    if ($voiceWave) $voiceWave.classList.add('on');

    if (SR) {
      const sr = new SR();
      sr.lang = 'en-IN'; sr.continuous = true;
      sr.onresult = e => {
        const t = Array.from(e.results).map(r => r[0].transcript).join(' ').toLowerCase();
        if (t.includes('help') || t.includes('sos') || t.includes('emergency')) {
          if ($voiceStat) $voiceStat.textContent = `🔊 Heard: "${t.slice(-25)}" — triggering SOS!`;
          triggerWomenSOS();
        }
      };
      sr.onerror = () => { if ($voiceStat) $voiceStat.textContent = '⚠️ Voice error — try again'; };
      sr.start();
      $voiceBtn._sr = sr;
    } else {
      if ($voiceStat) $voiceStat.textContent = '🎤 Simulated — tap Stop when done';
      // Simulate after 4s for demo purposes
      setTimeout(() => {
        if (_voiceOn && $voiceStat) $voiceStat.textContent = '🔊 Voice command detected — SOS ready';
      }, 4000);
    }
  } else {
    _voiceOn = false;
    if ($voiceCard) $voiceCard.classList.remove('listening');
    if ($voiceWave) $voiceWave.classList.remove('on');
    if ($voiceStat) $voiceStat.textContent = '⚫ Voice detection stopped';
    $voiceBtn.textContent = '🎤 Activate Voice SOS';
    if ($voiceBtn._sr) { try { $voiceBtn._sr.stop(); } catch {} $voiceBtn._sr = null; }
  }
});

/* ══════════════════════════════════════════════════════════
   EMERGENCY TIMER  (safety.html)
══════════════════════════════════════════════════════════ */
const $timerDisp  = document.getElementById('timer-display');
const $timerFill  = document.getElementById('timer-fill');
const $timerStart = document.getElementById('timer-start-btn');
const $timerReset = document.getElementById('timer-reset-btn');
const $timerSecs  = document.getElementById('timer-seconds');
let _timerInt = null, _timerLeft = 30, _timerMax = 30;

function renderTimer() {
  if (!$timerDisp) return;
  const mm = String(Math.floor(_timerLeft / 60)).padStart(2, '0');
  const ss = String(_timerLeft % 60).padStart(2, '0');
  $timerDisp.textContent = `${mm}:${ss}`;
  if ($timerFill) $timerFill.style.width = ((_timerLeft / _timerMax) * 100) + '%';
  $timerDisp.className = 'timer-display';
  if (_timerLeft <= 10) $timerDisp.classList.add('danger');
  else if (_timerLeft <= Math.floor(_timerMax * 0.4)) $timerDisp.classList.add('warn');
}

if ($timerStart) $timerStart.addEventListener('click', () => {
  if (_timerInt) return;
  _timerMax = _timerLeft = parseInt($timerSecs?.value || '30', 10) || 30;
  renderTimer();
  $timerStart.disabled = true;
  _timerInt = setInterval(() => {
    _timerLeft--;
    renderTimer();
    if (_timerLeft <= 0) {
      clearInterval(_timerInt); _timerInt = null;
      if ($timerStart) $timerStart.disabled = false;
      toast('⚠️ Timer expired — triggering SOS!', 'error', 5000);
      if ($wBtn) $wBtn.click(); else if ($sosBtn) $sosBtn.click();
    }
  }, 1000);
});

if ($timerReset) $timerReset.addEventListener('click', () => {
  clearInterval(_timerInt); _timerInt = null;
  _timerMax = _timerLeft = parseInt($timerSecs?.value || '30', 10) || 30;
  renderTimer();
  if ($timerStart) $timerStart.disabled = false;
});

/* ══════════════════════════════════════════════════════════
   CONTACTS PAGE
══════════════════════════════════════════════════════════ */
const $contactForm = document.getElementById('contact-form');
const $contactList = document.getElementById('contact-list');

if ($contactForm) {
  renderContacts();
  $contactForm.addEventListener('submit', e => {
    e.preventDefault();
    const name  = document.getElementById('c-name')?.value.trim();
    const phone = document.getElementById('c-phone')?.value.trim();
    if (!name || !phone) { toast('Fill in both name and phone.', 'error'); return; }
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 7 || clean.length > 15) { toast('Enter a valid phone number.', 'error'); return; }
    const contacts = getContacts();
    if (contacts.find(c => c.phone === clean)) { toast('Number already saved.', 'error'); return; }
    contacts.push({ id: Date.now(), name, phone: clean, raw: phone });
    setContacts(contacts); $contactForm.reset(); renderContacts();
    toast(`${name} added!`, 'success');
  });
}

function renderContacts() {
  if (!$contactList) return;
  const contacts = getContacts();
  const $cnt = document.getElementById('contact-count');
  const $clr = document.getElementById('clear-all-wrap');
  if ($cnt) $cnt.textContent = `${contacts.length} saved`;
  if ($clr) $clr.classList.toggle('hidden', contacts.length === 0);
  if (!contacts.length) {
    $contactList.innerHTML = `<div class="empty"><div class="ei">👥</div><p>No contacts yet.<br>Add your first contact above.</p></div>`;
    return;
  }
  $contactList.innerHTML = contacts.map(c => `
    <div class="c-item">
      <div class="c-avatar">${initials(c.name)}</div>
      <div class="c-info">
        <div class="c-name">${esc(c.name)}</div>
        <div class="c-phone">📞 ${esc(c.raw || c.phone)}</div>
      </div>
      <div class="c-actions">
        <button class="icon-btn ib-call" onclick="callContact('${c.phone}')" title="Call">📞</button>
        <button class="icon-btn ib-del"  onclick="delContact(${c.id})"       title="Delete">🗑️</button>
      </div>
    </div>`).join('');
}

window.delContact = id => { setContacts(getContacts().filter(c => c.id !== id)); renderContacts(); toast('Contact removed.'); };
window.callContact= phone => { window.location.href = `tel:${phone}`; };

const $clrAll = document.getElementById('clear-all-btn');
if ($clrAll) $clrAll.addEventListener('click', () => { if (confirm('Delete all contacts?')) { setContacts([]); renderContacts(); toast('All contacts cleared.'); } });

function initials(n) { return n.trim().split(' ').slice(0,2).map(w => w[0].toUpperCase()).join(''); }
function esc(s)      { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ══════════════════════════════════════════════════════════
   LOCATION PAGE
══════════════════════════════════════════════════════════ */
const $locBtn  = document.getElementById('get-location-btn');
const $latEl   = document.getElementById('lat-val');
const $lngEl   = document.getElementById('lng-val');
const $accEl   = document.getElementById('acc-val');
const $mapLink = document.getElementById('map-link');
const $mapPrev = document.getElementById('map-preview');
const $locStat = document.getElementById('loc-status');

if ($locBtn) { $locBtn.addEventListener('click', fetchLocation); fetchLocation(); }

async function fetchLocation() {
  if ($locBtn) { $locBtn.disabled = true; $locBtn.textContent = '📡 Fetching…'; }
  if ($locStat) $locStat.textContent = 'Requesting location access…';
  try {
    const pos = await getPos();
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    if ($latEl) $latEl.textContent = lat.toFixed(6);
    if ($lngEl) $lngEl.textContent = lng.toFixed(6);
    if ($accEl) $accEl.textContent = `±${Math.round(accuracy)}m`;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    if ($mapLink) { $mapLink.href = url; $mapLink.style.display = 'inline-flex'; }
    if ($mapPrev) $mapPrev.innerHTML = `<div class="map-pin">📍</div><p style="color:var(--sea);font-weight:600">${lat.toFixed(5)}, ${lng.toFixed(5)}</p><a href="${url}" target="_blank" rel="noopener" class="btn btn-ry mt-2" style="font-size:.83rem;padding:.48rem 1.25rem">🗺️ Open in Google Maps</a>`;
    if ($locStat) $locStat.textContent = '✅ Location retrieved';
    toast('Location fetched!', 'success');
  } catch (err) {
    const msg = err.code === 1 ? 'Location access denied.' : 'Could not get location.';
    if ($locStat) $locStat.textContent = '⚠️ ' + msg;
    toast(msg, 'error');
  } finally { if ($locBtn) { $locBtn.disabled = false; $locBtn.textContent = '🔄 Refresh Location'; } }
}

/* ══════════════════════════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════════════════════════ */
const $profileForm = document.getElementById('profile-form');
if ($profileForm) {
  const p = getProfile();
  ['p-name','p-age','p-blood','p-medical','p-emer-name','p-emer-phone'].forEach(id => {
    const el = document.getElementById(id);
    const key = id.replace('p-','').replace('-','_');
    if (el && p[key]) el.value = p[key];
  });
  refreshProfileDisplay();
  $profileForm.addEventListener('submit', e => {
    e.preventDefault();
    const np = {};
    ['p-name','p-age','p-blood','p-medical','p-emer-name','p-emer-phone'].forEach(id => {
      const el = document.getElementById(id);
      if (el) np[id.replace('p-','').replace('-','_')] = el.value;
    });
    setProfile(np); toast('Profile saved!', 'success'); refreshProfileDisplay();
  });
}

function refreshProfileDisplay() {
  const p = getProfile();
  const $av = document.getElementById('p-avatar-text');
  const $nm = document.getElementById('p-name-display');
  const $bl = document.getElementById('p-blood-display');
  const $md = document.getElementById('p-medical-display');
  const $en = document.getElementById('p-emer-display');
  if ($av && p.name) $av.textContent = initials(p.name);
  if ($nm) $nm.textContent = p.name || 'Your Name';
  if ($bl) $bl.textContent = p.blood || '—';
  if ($md) $md.textContent = p.medical || 'Not set';
  if ($en) $en.textContent = p.emer_name ? `${p.emer_name} — ${p.emer_phone || ''}` : 'Not set';
}

/* ══════════════════════════════════════════════════════════
   AI ASSISTANT CHAT PAGE
══════════════════════════════════════════════════════════ */
let _chatHistory = [];

window.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('chat-body')) return;
  addMsg('ai', `👋 **Hello! I'm Safenix's AI Emergency Assistant.**\n\nI provide instant, calm guidance for any emergency — from first aid to women's safety.\n\n**Quick start:** Type a situation below or tap a scenario card on the left.\n\n⚠️ For life-threatening emergencies, **always call 112 first.**`);
});

const $chatInput = document.getElementById('chat-input');
const $charCount = document.getElementById('char-count');
if ($chatInput) {
  $chatInput.addEventListener('input', () => {
    if ($charCount) $charCount.textContent = $chatInput.value.length;
    $chatInput.style.height = 'auto';
    $chatInput.style.height = Math.min($chatInput.scrollHeight, 110) + 'px';
  });
  $chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
}

window.sendQuick = text => {
  if (!$chatInput) return;
  $chatInput.value = text;
  if ($charCount) $charCount.textContent = text.length;
  sendChat();
};

async function sendChat() {
  if (!$chatInput) return;
  const text = $chatInput.value.trim();
  if (!text) return;
  const $sb = document.getElementById('send-btn');
  if ($sb) $sb.disabled = true;
  addMsg('user', text);
  _chatHistory.push({ role: 'user', content: text });
  $chatInput.value = ''; if ($charCount) $charCount.textContent = '0'; $chatInput.style.height = 'auto';
  const tid = showTyping();
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:1000,
        system:`You are Safenix's Emergency AI Assistant — calm, knowledgeable, India-focused. Give step-by-step emergency guidance. Always recommend calling 112 for life-threatening situations. Reference Indian helplines (Police 100, Ambulance 108, Women Helpline 1091, Fire 101, Child 1098). Use **bold** for critical actions. Number your steps. Keep responses clear and concise.`,
        messages: _chatHistory
      })
    });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    const aiText = d.content?.[0]?.text || 'I could not respond. Please call 112 for emergencies.';
    _chatHistory.push({ role:'assistant', content:aiText });
    removeTyping(tid); addMsg('ai', aiText);
  } catch (err) {
    removeTyping(tid);
    addMsg('ai', err.message.includes('fetch') ? '⚠️ **Connection error.** Check internet. Call **112** for emergencies.' : `⚠️ Error: ${err.message}. Call **112** for emergencies.`);
  } finally { if ($sb) { $sb.disabled = false; $chatInput.focus(); } }
}

function addMsg(role, text) {
  const body = document.getElementById('chat-body'); if (!body) return;
  const w = document.createElement('div'); w.className = `msg ${role}`;
  const av = document.createElement('div'); av.className = 'm-avatar'; av.textContent = role === 'ai' ? '🤖' : '👤';
  const bw = document.createElement('div'); bw.style.cssText = 'display:flex;flex-direction:column';
  const b  = document.createElement('div'); b.className = 'm-bubble'; b.innerHTML = md(text);
  const tm = document.createElement('div'); tm.className = 'm-time'; tm.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  bw.appendChild(b); bw.appendChild(tm); w.appendChild(av); w.appendChild(bw); body.appendChild(w);
  body.scrollTop = body.scrollHeight;
}

let _typCtr = 0;
function showTyping() {
  const body = document.getElementById('chat-body'); if (!body) return 0;
  const id = `t${++_typCtr}`;
  const w = document.createElement('div'); w.className = 'msg ai'; w.id = id;
  w.innerHTML = `<div class="m-avatar">🤖</div><div class="typing"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;
  body.appendChild(w); body.scrollTop = body.scrollHeight; return id;
}
function removeTyping(id) { document.getElementById(id)?.remove(); }
window.clearChat = () => { if (!confirm('Clear conversation?')) return; _chatHistory = []; const b = document.getElementById('chat-body'); if (b) b.innerHTML = ''; addMsg('ai', '🔄 Chat cleared. How can I help you?'); };

/* ── ESC closes overlays ── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  [$sosOver, $wOver].forEach(o => o?.classList.remove('active'));
  $fakeScreen?.classList.remove('active');
  stopRec();
});
