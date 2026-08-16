// Contact Us — two points of contact with profile photo + mailto.
const CONTACTS = [
  {
    name: 'Randal Burns',
    email: 'raburns@microsoft.com',
    photo: 'media/contact-randy.jpg',
    blurb: 'For questions on your specific use case and how we can help.',
  },
  {
    name: 'Paul Shaheen',
    email: 'paulshaheen@microsoft.com',
    photo: 'media/contact-paul.jpg',
    blurb: 'For technical questions and how this technology can work for you.',
  },
];

module.exports = function(page, section) {

  const cards = CONTACTS.map(c => `
    <div class="contact-card">
      <img class="contact-photo" src="${c.photo}" alt="${c.name}" width="120" height="120" loading="lazy" />
      <div class="contact-name">${c.name}</div>
      <p class="contact-blurb">${c.blurb}</p>
      <a class="cta-btn" href="mailto:${c.email}?subject=Predictive%20Maintenance%20Accelerator">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Email ${c.name.split(' ')[0]}
      </a>
      <div class="contact-email">${c.email}</div>
    </div>`).join('\n');

  const body = `

<style>
  .contact-grid { display:flex; gap:24px; flex-wrap:wrap; margin:28px 0 8px; }
  .contact-card {
    flex:1 1 280px; min-width:260px;
    background: var(--card, rgba(255,255,255,0.03));
    border:1px solid var(--border, rgba(255,255,255,0.08));
    border-radius:16px; padding:28px 24px; text-align:center;
    display:flex; flex-direction:column; align-items:center;
    transition: border-color .2s, transform .2s;
  }
  .contact-card:hover { border-color: var(--accent); transform: translateY(-3px); }
  .contact-photo {
    width:120px; height:120px; border-radius:50%; object-fit:cover;
    border:3px solid var(--accent); margin-bottom:16px;
    box-shadow:0 6px 20px rgba(0,0,0,0.28);
  }
  .contact-name { font-size:1.25rem; font-weight:700; margin-bottom:8px; }
  .contact-blurb { color: var(--text-dim, #9aa4b2); font-size:.98rem; line-height:1.5; margin:0 0 20px; max-width:34ch; }
  .contact-card .cta-btn { margin-bottom:12px; }
  .contact-email { font-size:.85rem; color: var(--text-dim, #9aa4b2); }
  .contact-email a, .contact-email { word-break:break-all; }
</style>

<h1>Contact Us</h1>
<p class="subtitle">Interested in bringing OneGrid to your operation? Reach out — we're happy to talk through your assets, your data, and the fastest path to value.</p>

<div class="contact-grid">
${cards}
</div>

<div class="callout">Prefer to explore first? Head to <a href="get-started.html">Try it Now</a> to launch the live app or deploy the accelerator into your own tenant.</div>

  `;

  page("contact.html", "Contact Us", "Get in touch about the OneGrid accelerator — use-case fit and technical questions", body);
};
