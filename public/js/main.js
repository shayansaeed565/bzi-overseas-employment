/* ==========================================================================
   BZI — frontend behaviour
   Talks to the Python backend at /api/*
   ========================================================================== */

(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ------------------------------------------------------------------
     Toast helper
     ------------------------------------------------------------------ */
  function toast(message, type) {
    let wrap = $('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(() => el.remove(), 400);
    }, 4200);
  }

  async function api(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  function setFormStatus(form, message, ok) {
    const box = form.querySelector('.form-status');
    if (!box) return;
    box.textContent = message;
    box.className = 'form-status ' + (ok ? 'ok' : 'err');
  }

  /* ------------------------------------------------------------------
     Site config + license countdown
     ------------------------------------------------------------------ */
  const state = {
    license: null,
    expiryTs: null,
    countdownTimer: null,
  };

  async function loadSite() {
    try {
      const data = await api('/api/site');
      state.license = data.license;
      if (data.license && data.license.expiresAt) {
        state.expiryTs = new Date(data.license.expiresAt + 'T23:59:59').getTime();
      }
      renderLicense();
      renderTopbar(data);
      renderStats(data.stats);
      startCountdown();
    } catch (err) {
      console.warn('Could not load site config:', err.message);
    }
  }

  function renderTopbar(data) {
    const lic = data.license;
    if (!lic) return;
    const pill = $('#lic-status-pill');
    const ticker = $('#ticker-countdown');
    if (pill) {
      const labels = { active: 'License Active', expiring: 'Expiring Soon', expired: 'License Expired', unknown: 'License Status' };
      pill.className = 'status-pill ' + lic.status;
      pill.innerHTML = '<span class="status-dot"></span>' + (labels[lic.status] || 'License');
      if (ticker && lic.status !== 'unknown') {
        if (lic.status === 'expired') {
          ticker.textContent = 'License No. ' + lic.licenseNo + ' — RENEWAL REQUIRED';
        } else {
          ticker.textContent = 'License No. ' + lic.licenseNo + ' — expires ' +
            (lic.expiresAt ? new Date(lic.expiresAt + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'soon');
        }
      }
    }
  }

  function renderStats(stats) {
    if (!stats) return;
    const map = { years: 'years', deployed: 'deployed', satisfaction: 'satisfaction', compliance: 'compliance' };
    Object.keys(map).forEach((key) => {
      const el = $('[data-stat="' + key + '"]');
      if (el && stats[key]) el.textContent = stats[key];
    });
  }

  function renderLicense() {
    const lic = state.license;
    if (!lic) return;
    const box = $('#license-countdown');
    if (!box) return;
    // Status line in the license section
    const statusEl = $('#lic-section-status');
    if (statusEl) {
      const text = lic.status === 'active' ? 'ACTIVE' : lic.status === 'expiring' ? 'EXPIRING SOON' : lic.status === 'expired' ? 'EXPIRED' : '—';
      statusEl.textContent = text;
    }
    const expiryEl = $('#lic-expiry-date');
    if (expiryEl && lic.expiresAt) {
      expiryEl.textContent = new Date(lic.expiresAt + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }

  function startCountdown() {
    if (!state.expiryTs) return;
    if (state.countdownTimer) clearInterval(state.countdownTimer);

    function tick() {
      const cells = {
        days: $('#cd-days'), hours: $('#cd-hours'), mins: $('#cd-mins'), secs: $('#cd-secs'),
      };
      if (!cells.days && !cells.secs) return;
      let diff = state.expiryTs - Date.now();
      if (diff < 0) diff = 0;
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const pad = (n) => String(n).padStart(2, '0');
      if (cells.days) cells.days.textContent = String(d);
      if (cells.hours) cells.hours.textContent = pad(h);
      if (cells.mins) cells.mins.textContent = pad(m);
      if (cells.secs) cells.secs.textContent = pad(s);
    }
    tick();
    state.countdownTimer = setInterval(tick, 1000);
  }

  /* ------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------ */
  function initNav() {
    const hamburger = $('#hamburger');
    const menu = $('#mobile-menu');
    const nav = $('.nav');

    if (hamburger && menu) {
      hamburger.addEventListener('click', () => {
        const open = menu.classList.toggle('open');
        hamburger.classList.toggle('open', open);
        hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $$('a', menu).forEach((a) => a.addEventListener('click', () => {
        menu.classList.remove('open');
        hamburger.classList.remove('open');
      }));
    }

    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 8);
      $('#top-float').classList.toggle('show', window.scrollY > 700);
    }, { passive: true });

    // Active section highlighting
    const sections = $$('section[id]');
    const links = $$('.nav-links a[href^="#"]');
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  /* ------------------------------------------------------------------
     Reveal animations
     ------------------------------------------------------------------ */
  function initReveals() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    $$('.reveal').forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------
     Jobs
     ------------------------------------------------------------------ */
  async function loadJobs() {
    const grid = $('#job-listings');
    if (!grid) return;
    try {
      const data = await api('/api/jobs');
      if (!data.jobs || !data.jobs.length) {
        grid.innerHTML = '<p class="center" style="grid-column:1/-1;color:var(--muted)">New vacancies are being confirmed. Please check back shortly.</p>';
        return;
      }
      grid.innerHTML = data.jobs.map((job, i) => {
        const badgeClass = (job.type || '').toLowerCase() === 'unskilled' ? 'unskilled'
          : (job.type || '').toLowerCase() === 'semi' ? 'semi' : 'skilled';
        return `
          <article class="job-card reveal reveal-delay-${i % 3}">
            <div class="top">
              <h3>${escapeHtml(job.title)}</h3>
              <span class="job-badge ${badgeClass}">${escapeHtml(job.type || 'Skilled')}</span>
            </div>
            <div class="body">
              <div class="meta">
                <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHtml(job.country)}</span>
                <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>${escapeHtml(job.salary)}</span>
              </div>
              <p class="desc">${escapeHtml(job.description || '')}</p>
              <span class="seats"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/></svg>${job.seats} seats available</span>
            </div>
            <div class="foot">
              <button class="btn btn-navy apply-role" data-trade="${escapeAttr(job.title)}">Apply For This Role</button>
            </div>
          </article>`;
      }).join('');

      $$('.apply-role', grid).forEach((btn) => {
        btn.addEventListener('click', () => {
          const trade = btn.dataset.trade || '';
          const input = $('#app-trade');
          if (input) input.value = trade;
          scrollToId('apply');
        });
      });
      initReveals();
    } catch (err) {
      grid.innerHTML = '<p class="center" style="grid-column:1/-1;color:var(--muted)">Could not load vacancies.</p>';
    }
  }

  /* ------------------------------------------------------------------
     Flight search
     ------------------------------------------------------------------ */
  function collectSearch(form) {
    return {
      from: $('[data-f="from"]', form).value.trim(),
      to: $('[data-f="to"]', form).value.trim(),
      date: $('[data-f="date"]', form).value,
      passengers: $('[data-f="passengers"]', form).value || '1',
    };
  }

  async function doSearch(form) {
    const q = collectSearch(form);
    const resultsEl = $('#flight-results');
    if (!resultsEl) return;
    if (!q.from || !q.to) {
      toast('Please enter both departure and destination cities.', 'err');
      return;
    }
    resultsEl.innerHTML = '<div class="results-head"><h3>Searching flights…</h3></div>';
    try {
      const url = '/api/flight-search?from=' + encodeURIComponent(q.from) + '&to=' + encodeURIComponent(q.to) +
        '&date=' + encodeURIComponent(q.date) + '&passengers=' + encodeURIComponent(q.passengers);
      const data = await api(url);

      if (!data.results.length) {
        resultsEl.innerHTML = `
          <div class="results-head"><h3>No direct flights found for <span>${escapeHtml(q.from)} → ${escapeHtml(q.to)}</span></h3></div>
          <p style="color:#B9C6DE;font-size:14px">Call us on <a href="tel:+923009634530" style="color:#F6C94A;font-weight:700">+92 300 9634530</a> and our ticketing desk will arrange the best connecting option for you.</p>`;
        return;
      }

      resultsEl.innerHTML = `
        <div class="results-head">
          <h3>${data.results.length} flight${data.results.length > 1 ? 's' : ''} found — <span>${escapeHtml(q.from)} → ${escapeHtml(q.to)}</span>${q.date ? ' · ' + escapeHtml(q.date) : ''}</h3>
          <span class="reset" id="results-reset">Clear results</span>
        </div>
        ${data.results.map((f) => flightCard(f, q)).join('')}
        <p style="color:#8FA0C0;font-size:12.5px;margin-top:14px;text-align:center">Fares are indicative (PKR, round trip per passenger) and confirmed at booking time. 24/7 support: +92 300 9634530.</p>`;

      $('#results-reset').addEventListener('click', () => { resultsEl.innerHTML = ''; });

      $$('.flight-card', resultsEl).forEach((card) => {
        card.addEventListener('click', () => openBookingModal(card.dataset));
      });

      resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      resultsEl.innerHTML = '<p style="color:#FCA5A5">' + escapeHtml(err.message) + '</p>';
    }
  }

  function flightCard(f, q) {
    const stops = f.stops === 0 ? 'Non-stop' : f.stops === 1 ? '1 stop' : f.stops + ' stops';
    const initials = (f.airline || 'BZI').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
    return `
      <div class="flight-card" data-airline="${escapeAttr(f.airline)}" data-flight="${escapeAttr(f.flight)}"
           data-from="${escapeAttr(q.from)}" data-to="${escapeAttr(q.to)}" data-date="${escapeAttr(q.date)}"
           data-passengers="${escapeAttr(q.passengers)}" data-price="${escapeAttr(f.priceFormatted)}">
        <div class="airline">
          <span class="flight-logo">${escapeHtml(initials)}</span>
          <div><b>${escapeHtml(f.airline)}</b><span>${escapeHtml(f.flight)}</span></div>
        </div>
        <div class="times">
          <div class="t"><b>${escapeHtml(f.depart)}</b><span>${escapeHtml(q.from)}</span></div>
          <div class="path">
            <div class="line"></div>
            <span class="stops-badge">${stops} · ${escapeHtml(f.duration)}</span>
          </div>
          <div class="t"><b>${escapeHtml(f.arrive)}</b><span>${escapeHtml(q.to)}</span></div>
        </div>
        <div class="price">
          <b>${escapeHtml(f.priceFormatted)}</b>
          <span>${escapeHtml((f.classes || ['Economy']).join(' · '))}</span>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Booking modal
     ------------------------------------------------------------------ */
  function openBookingModal(route) {
    const modal = $('#booking-modal');
    if (!modal) return;
    const card = $('#booking-card');
    if (!card) return;
    card.innerHTML = `
      <button class="modal-close" id="booking-close" aria-label="Close">&times;</button>
      <h3>Book This Flight</h3>
      <p class="route-summary">${escapeHtml(route.airline || '')} ${escapeHtml(route.flight || '')} · <b>${escapeHtml(route.from)} → ${escapeHtml(route.to)}</b>${route.date ? ' · ' + escapeHtml(route.date) : ''}</p>
      <form id="booking-form" class="form-grid">
        <div class="field-control"><label>Full Name</label><input type="text" name="name" placeholder="As per passport" required></div>
        <div class="field-control"><label>Contact Number</label><input type="tel" name="phone" placeholder="03XX-XXXXXXX" required></div>
        <div class="field-control"><label>Departure City</label><input type="text" name="from" value="${escapeAttr(route.from || '')}" required></div>
        <div class="field-control"><label>Destination</label><input type="text" name="to" value="${escapeAttr(route.to || '')}" required></div>
        <div class="field-control"><label>Travel Date</label><input type="date" name="date" value="${escapeAttr(route.date || '')}"></div>
        <div class="field-control"><label>Passengers</label>
          <select name="passengers">
            <option value="1" ${route.passengers === '1' ? 'selected' : ''}>1 Passenger</option>
            <option value="2" ${route.passengers === '2' ? 'selected' : ''}>2 Passengers</option>
            <option value="3" ${route.passengers === '3' ? 'selected' : ''}>3 Passengers</option>
            <option value="4">4+ Passengers</option>
          </select>
        </div>
        <div class="field-control full"><label>Notes (optional)</label><textarea name="notes" placeholder="Visa requirements, Umrah, group booking…"></textarea></div>
        <div class="form-status full"></div>
        <div class="full">
          <button class="btn btn-primary form-submit" type="submit">Request Booking</button>
        </div>
      </form>`;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    $('#booking-close').addEventListener('click', closeBookingModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeBookingModal(); });

    const form = $('#booking-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        from: form.from.value.trim(),
        to: form.to.value.trim(),
        date: form.date.value,
        passengers: form.passengers.value,
        airline: route.airline || '',
        notes: form.notes ? form.notes.value.trim() : '',
      };
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const res = await api('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setFormStatus(form, '✓ Booking request received — reference ' + res.ref + '. Our ticketing desk will call you shortly.', true);
        toast('Booking requested — ref ' + res.ref, 'ok');
        btn.textContent = 'Request Another';
        btn.disabled = false;
      } catch (err) {
        setFormStatus(form, err.message, false);
        btn.textContent = 'Request Booking';
        btn.disabled = false;
      }
    });
  }

  function closeBookingModal() {
    const modal = $('#booking-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ------------------------------------------------------------------
     Application form
     ------------------------------------------------------------------ */
  function initApplicationForm() {
    const form = $('#application-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const phone = form.phone.value.trim();
      const trade = form.trade.value.trim();
      const btn = form.querySelector('button[type="submit"]');
      const file = form.cv ? (form.cv.files && form.cv.files[0] ? form.cv.files[0].name : '') : '';

      if (!name || !phone || !trade) {
        setFormStatus(form, 'Please fill in your name, contact number and trade.', false);
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Submitting…';
      try {
        const res = await api('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, phone, trade,
            experience: form.experience.value,
            country: form.country.value,
            cvFile: file,
          }),
        });
        setFormStatus(form, '✓ Thank you ' + name + '! Application received (ref ' + res.ref + '). Our HR team will contact you on ' + phone + '.', true);
        toast('Application submitted — ref ' + res.ref, 'ok');
        form.reset();
        btn.textContent = 'Submit Application';
        btn.disabled = false;
      } catch (err) {
        setFormStatus(form, err.message, false);
        btn.textContent = 'Submit Application';
        btn.disabled = false;
      }
    });
  }

  /* ------------------------------------------------------------------
     Contact form
     ------------------------------------------------------------------ */
  function initContactForm() {
    const form = $('#contact-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const res = await api('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.value.trim(),
            phone: form.phone.value.trim(),
            email: form.email.value.trim(),
            subject: form.subject.value.trim(),
            message: form.message.value.trim(),
          }),
        });
        setFormStatus(form, '✓ Message received (ref ' + res.ref + '). We will reply within 24 hours.', true);
        toast('Message sent — ref ' + res.ref, 'ok');
        form.reset();
        btn.textContent = 'Send Message';
        btn.disabled = false;
      } catch (err) {
        setFormStatus(form, err.message, false);
        btn.textContent = 'Send Message';
        btn.disabled = false;
      }
    });
  }

  /* ------------------------------------------------------------------
     Newsletter
     ------------------------------------------------------------------ */
  function initNewsletter() {
    const form = $('#newsletter-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const email = input.value.trim();
      if (!email) { toast('Please enter your email address.', 'err'); return; }
      try {
        const res = await api('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        toast(res.message || 'Subscribed!', 'ok');
        form.reset();
      } catch (err) {
        toast(err.message, 'err');
      }
    });
  }

  /* ------------------------------------------------------------------
     FAQ
     ------------------------------------------------------------------ */
  function initFaq() {
    $$('.faq-item').forEach((item) => {
      const q = item.querySelector('.faq-q');
      q.addEventListener('click', () => {
        const isOpen = item.classList.contains('active');
        $$('.faq-item').forEach((i) => i.classList.remove('active'));
        if (!isOpen) item.classList.add('active');
      });
    });
  }

  /* ------------------------------------------------------------------
     License lightbox
     ------------------------------------------------------------------ */
  function initLightbox() {
    const img = $('#license-thumb');
    const box = $('#license-lightbox');
    if (!img || !box) return;
    img.addEventListener('click', () => box.classList.add('open'));
    $('#lightbox-close').addEventListener('click', () => box.classList.remove('open'));
    box.addEventListener('click', (e) => { if (e.target === box) box.classList.remove('open'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') box.classList.remove('open'); });
  }

  /* ------------------------------------------------------------------
     Misc helpers
     ------------------------------------------------------------------ */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const nav = $('.nav');
    const offset = nav ? nav.offsetHeight + 8 : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  function initPopularRoutes() {
    $$('.route-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const from = chip.dataset.from;
        const to = chip.dataset.to;
        const heroForm = $('#hero-search');
        const flightsForm = $('#flights-search');
        [heroForm, flightsForm].forEach((f) => {
          if (!f) return;
          $('[data-f="from"]', f).value = from;
          $('[data-f="to"]', f).value = to;
        });
        if (flightsForm) {
          doSearch(flightsForm);
          scrollToId('flights');
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initReveals();
    loadSite();
    loadJobs();
    initFaq();
    initLightbox();
    initApplicationForm();
    initContactForm();
    initNewsletter();
    initPopularRoutes();

    // Flight searches (hero + flights section)
    ['hero-search', 'flights-search'].forEach((id) => {
      const form = document.getElementById(id);
      if (!form) return;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        doSearch(form);
      });
    });

    // Top float button
    $('#top-float').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // Close booking modal with Escape
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBookingModal(); });

    // Footer year
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();

    // Smooth scroll for anchor links with fixed nav offset
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length > 1 && document.getElementById(id.slice(1))) {
          e.preventDefault();
          scrollToId(id.slice(1));
        }
      });
    });
  });
})();
