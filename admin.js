(function(){
  const rowsEl = document.getElementById('rows');
  const statusEl = document.getElementById('status');
  const refreshBtn = document.getElementById('refresh');
  const secretInput = document.getElementById('secret');

  async function load() {
    rowsEl.innerHTML = '';
    statusEl.innerText = 'Loading...';
    const secret = secretInput.value.trim();
    const url = '/api/registrations' + (secret ? ('?secret=' + encodeURIComponent(secret)) : '');
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) { statusEl.innerText = 'Error: ' + (json.error||'unknown'); return; }
      statusEl.innerText = 'Loaded ' + (json.registrations||[]).length + ' rows';
      (json.registrations||[]).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.id}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.email)}</td><td>${escapeHtml(r.phone)}</td><td>${escapeHtml(r.eventId)}</td><td>${r.createdAt}</td><td><button data-id="${r.id}">Resend</button></td>`;
        rowsEl.appendChild(tr);
      });
    } catch (err) {
      statusEl.innerText = 'Fetch error';
      console.error(err);
    }
  }

  function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

  rowsEl.addEventListener('click', async (e)=>{
    if(e.target.tagName.toLowerCase() !== 'button') return;
    const id = e.target.dataset.id;
    const secret = secretInput.value.trim();
    if(!secret) { alert('Enter admin secret'); return; }
    e.target.disabled = true; e.target.innerText = 'Sending...';
    try{
      const res = await fetch('/api/registrations/'+encodeURIComponent(id)+'/resend?secret='+encodeURIComponent(secret),{ method:'POST' });
      const json = await res.json();
      if(json.success) { alert('Email resent'); } else { alert('Error: '+(json.error||'failed')); }
    }catch(err){ alert('Network error'); }
    e.target.disabled = false; e.target.innerText = 'Resend';
  });

  refreshBtn.addEventListener('click', load);
  // try auto-load with empty secret if allowed
  load();
})();
