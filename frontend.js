// Frontend API wrapper and UI wiring for Vidyutrenz
const API_BASE = window.location.origin + '/api';

async function fetchEvents() {
  const res = await fetch(API_BASE + '/events');
  const json = await res.json();
  return json.events || {};
}

async function fetchEvent(id) {
  const res = await fetch(API_BASE + '/events/' + encodeURIComponent(id));
  if (!res.ok) return null;
  const json = await res.json();
  return json.event || null;
}

async function submitRegistration(payload) {
  const res = await fetch(API_BASE + '/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// Show a simple on-page status (optional)
function showStatus(msg, type = 'info') {
  console.log(`[status:${type}]`, msg);
}

// Modal logic using server data when available
async function openModal(id) {
  const data = await fetchEvent(id);
  if (!data) {
    if (window.eventData && window.eventData[id]) {
      return window.openModalOriginal ? window.openModalOriginal(id) : null;
    }
    alert('Event details not available');
    return;
  }

  document.getElementById('modalTitle').innerText = data.title || 'Event';
  document.getElementById('modalContact').innerHTML = `Event Coordinator: ${data.contact || ''}`;
  document.getElementById('modalDesc').innerText = data.desc || '';
  const list = document.getElementById('modalRules');
  list.innerHTML = '';
  (data.rules || []).forEach(r => {
    let li = document.createElement('li');
    li.innerText = r;
    list.appendChild(li);
  });
  document.getElementById('eventModal').classList.add('open');
}

if (window.openModal) window.openModalOriginal = window.openModal;
window.openModal = openModal;

// Wire contact form to submit to backend (use id for reliability)
(function wireContactForm(){
  const form = document.getElementById('contactForm') || document.querySelector('.contact form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // gather fields
    const nameEl = form.querySelector('input[placeholder*="Full" i], input[placeholder*="full" i]');
    const emailEl = form.querySelector('input[type="email"], input[placeholder*="email" i]');
    const phoneEl = form.querySelector('input[placeholder*="mobile" i], input[type="tel"]');
    const selectEl = form.querySelector('#eventSelect');
    const textareaEl = form.querySelector('textarea');

    const payload = {
      name: nameEl ? nameEl.value.trim() : '',
      email: emailEl ? emailEl.value.trim() : '',
      phone: phoneEl ? phoneEl.value.trim() : '',
      eventId: selectEl ? (selectEl.value || null) : null,
      message: textareaEl ? textareaEl.value.trim() : ''
    };

    // basic validation
    if (!payload.name || !payload.email) {
      alert('Please provide your name and email.');
      return;
    }

    showStatus('Submitting registration...');
    try {
      const result = await submitRegistration(payload);
      if (result && result.success) {
        alert('Registration saved. Thank you!');
        form.reset();
        showStatus('Registration successful', 'success');
      } else {
        alert('Failed to submit. Try again later.');
        showStatus('Server returned failure', 'error');
      }
    } catch (err) {
      console.error('Submit error', err);
      alert('Network error. Could not submit.');
      showStatus('Network error', 'error');
    }
  });
})();

