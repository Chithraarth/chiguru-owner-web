import { useEffect, useRef } from "react";

// Marketing landing page shown to signed-out visitors, ahead of the sign-in
// gate in App.tsx. Body markup is injected as raw HTML (not JSX) because it
// carries its own self-contained CSS/canvas-animation design that doesn't
// map onto the app's Tailwind/shadcn setup — see the <style> block below.
// Clicking "Sign In", "Start Free", or any pricing CTA hands off to the real
// sign-in page via onGetStarted; every other link is an in-page anchor.
const LANDING_HTML = String.raw`
<nav class="nav">
  <div class="wrap nav-row">
    <a class="brand" href="#top">
      <svg class="brand-mark" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 29c0-8 0-14 6-19" stroke="#2f6b40" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M16 29c0-6-2-10-7-13" stroke="#2f6b40" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M4 21c3 6 9 9 9 9M22 10c3-1 6-4 6-4" stroke="#2f6b40" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="16" cy="29" r="1.6" fill="#2f6b40"/>
      </svg>
      Chiguru
    </a>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#managers">For Managers</a>
      <a href="#ai">AI Tools</a>
      <a href="#pricing">Pricing</a>
      <a href="#faq">FAQ</a>
    </div>
    <div class="nav-cta">
      <a class="btn btn-ghost" href="#" data-nav="auth" style="padding:10px 18px;">Sign In</a>
      <a class="btn btn-gold" href="#" data-nav="auth" style="padding:10px 18px;">Start Free</a>
      <button class="nav-toggle" aria-label="Open menu" data-open-mobile-nav>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
    </div>
  </div>
</nav>

<div class="mobile-sheet" id="mobileSheet">
  <div class="mobile-sheet-head">
    <span class="brand" style="font-size:1.1rem;">Chiguru</span>
    <button class="nav-toggle" aria-label="Close menu" data-close-mobile-nav>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
  <nav>
    <a href="#features" data-close-mobile-nav>Features</a>
    <a href="#managers" data-close-mobile-nav>For Managers</a>
    <a href="#ai" data-close-mobile-nav>AI Tools</a>
    <a href="#pricing" data-close-mobile-nav>Pricing</a>
    <a href="#faq" data-close-mobile-nav>FAQ</a>
  </nav>
  <a class="btn btn-gold" href="#" data-nav="auth">Start Free</a>
</div>

<main id="top">
  <!-- HERO -->
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <span class="eyebrow">Farm management, digitized</span>
        <h1>Every kata entry.<br>One farm ledger.<br>Zero paper.</h1>
        <p class="lede">Chiguru turns your farm's account book, attendance register, and harvest records into one system your whole operation runs on — readable by you, your managers, and an AI that can even read your <em>old</em> paper ledgers.</p>
        <div class="hero-ctas">
          <a class="btn btn-gold" href="#" data-nav="auth">Start your farm — free to set up</a>
          <a class="btn btn-ghost" href="#features">See how it works</a>
        </div>
        <div class="hero-trust">
          <div><b class="tabular">3</b><span>Subscription tiers</span></div>
          <div><b class="tabular">₹499</b><span>Starting per month</span></div>
          <div><b>Owner + Manager</b><span>Apps included</span></div>
        </div>
      </div>
      <div class="ledger-canvas-wrap">
        <span class="tag">Scan Old Account Book</span>
        <canvas id="ledgerCanvas" width="600" height="440" aria-label="Animation of a handwritten farm ledger being scanned and converted into digital rows"></canvas>
        <p class="ledger-caption">Photograph a page of your kata — Chiguru's AI reads every entry in seconds.</p>
      </div>
    </div>
  </section>

  <hr class="rule">

  <!-- PROBLEM / SOLUTION -->
  <section>
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Why Chiguru</span>
        <h2>Your farm's records shouldn't live in three different notebooks — and your memory.</h2>
      </div>
      <div class="split">
        <div class="split-card old">
          <h3>Before</h3>
          <ul>
            <li><span class="mark">×</span>Expenses in one notebook, harvest weights in another</li>
            <li><span class="mark">×</span>Labour payments tracked from memory, disputes later</li>
            <li><span class="mark">×</span>No idea if this season is actually profitable until it's over</li>
            <li><span class="mark">×</span>A manager's update means a phone call you might miss</li>
            <li><span class="mark">×</span>Years of old ledgers, never digitized, never searchable</li>
          </ul>
        </div>
        <div class="split-card new">
          <span class="eyebrow">After</span>
          <h3>With Chiguru</h3>
          <ul>
            <li><span class="mark">✓</span>Every expense, harvest, and loan in one running ledger</li>
            <li><span class="mark">✓</span>Attendance and labour payments logged the day they happen</li>
            <li><span class="mark">✓</span>Season, monthly, and weekly profit & loss — always current</li>
            <li><span class="mark">✓</span>Your manager marks attendance from their own phone, instantly</li>
            <li><span class="mark">✓</span>Photograph your old account books — AI reads and files every entry</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <hr class="rule">

  <!-- FEATURES -->
  <section id="features">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">The ledger</span>
        <h2>Everything a working farm needs to track, in one book.</h2>
        <p>Not a generic spreadsheet — built around how a smallholder or estate farm actually keeps records.</p>
      </div>
      <div class="ledger">
        <div class="ledger-row">
          <div class="ledger-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
          </div>
          <div class="ledger-body">
            <span class="ledger-tag">Farm Accounts</span>
            <h3>Expenses, Harvest, Loans &amp; Reports</h3>
            <p>Log every expense and harvest as it happens, track loans and loan repayments, and get season, monthly, and weekly profit &amp; loss reports without waiting for an accountant.</p>
          </div>
        </div>
        <div class="ledger-row">
          <div class="ledger-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h13M4 5l3 3M4 5l3-3"/><rect x="8" y="10" width="12" height="10" rx="1.5"/><path d="M11 13h6M11 16h4"/></svg>
          </div>
          <div class="ledger-body">
            <span class="ledger-tag">Scan Old Account Book</span>
            <h3>Digitize years of handwritten kata in minutes</h3>
            <p>Photograph a page of your old account book — labour costs, purchases, sales — and Chiguru's AI reads every line and files it into your ledger automatically.</p>
          </div>
        </div>
        <div class="ledger-row">
          <div class="ledger-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6"/><circle cx="18" cy="9" r="2.4"/><path d="M15 20c0-3 1.5-4.5 3-4.5"/></svg>
          </div>
          <div class="ledger-body">
            <span class="ledger-tag">Attendance &amp; Work Groups</span>
            <h3>Daily attendance, by the group</h3>
            <p>Organize workers into groups, mark attendance in seconds, and track advance payments per group — no more end-of-week guesswork.</p>
            <div class="roster" aria-hidden="true">
              <div class="roster-person">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>
                <span class="roster-check" style="--i:0"><svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.2 2.2L9.5 3.8"/></svg></span>
              </div>
              <div class="roster-person">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>
                <span class="roster-check" style="--i:1"><svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.2 2.2L9.5 3.8"/></svg></span>
              </div>
              <div class="roster-person">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>
                <span class="roster-check" style="--i:2"><svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.2 2.2L9.5 3.8"/></svg></span>
              </div>
              <div class="roster-person">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>
                <span class="roster-check" style="--i:3"><svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.2 2.2L9.5 3.8"/></svg></span>
              </div>
              <div class="roster-person">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>
                <span class="roster-check" style="--i:4"><svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.2 2.2L9.5 3.8"/></svg></span>
              </div>
            </div>
          </div>
        </div>
        <div class="ledger-row">
          <div class="ledger-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21c1-5 4-8 9-8s8 3 9 8"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="ledger-body">
            <span class="ledger-tag">Managers</span>
            <h3>Invite a manager with just a phone number</h3>
            <p>No password to manage — your manager signs in with an OTP on their own phone, marks attendance and posts daily work, and it lands in your ledger instantly. Add and remove managers as your team changes.</p>
          </div>
        </div>
        <div class="ledger-row">
          <div class="ledger-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-6h6v6"/></svg>
          </div>
          <div class="ledger-body">
            <span class="ledger-tag">Multi-Estate</span>
            <h3>Run more than one farm from one account</h3>
            <p>Switch between estates without switching apps — every estate keeps its own workers, ledger, and reports, all under a single sign-in.</p>
          </div>
        </div>
        <div class="ledger-row">
          <div class="ledger-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 1116 0 8 8 0 01-16 0z"/><path d="M12 8v4l3 2"/></svg>
          </div>
          <div class="ledger-body">
            <span class="ledger-tag">Offline-First</span>
            <h3>Works in the field, syncs when you're back online</h3>
            <p>No signal at the far edge of the estate? Records queue on the phone and sync the moment connectivity returns — nothing is lost.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CROP STRIP -->
  <div class="crop-strip">
    <div class="wrap crop-strip-inner">
      <div class="crop">
        <div class="crop-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21c0-6 2-9 2-13"/><circle cx="15" cy="6" r="1.6"/><circle cx="12.5" cy="9.5" r="1.6"/><circle cx="15.5" cy="11" r="1.6"/><path d="M12 21c-3-1-4-4-3-7"/></svg>
        </div>
        <span>Coffee</span>
      </div>
      <div class="crop">
        <div class="crop-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21V6"/><path d="M12 8c-2-2-5-2-6 0 2 2 4 2 6 0zM12 12c-2-2-5-2-6 0 2 2 4 2 6 0zM12 8c2-2 5-2 6 0-2 2-4 2-6 0zM12 12c2-2 5-2 6 0-2 2-4 2-6 0z"/></svg>
        </div>
        <span>Pepper</span>
      </div>
      <div class="crop">
        <div class="crop-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20c4-8 12-8 16 0"/><path d="M7 20c1-4 2-6 5-9M12 20c.5-4 1.5-7 4-10M17 20c.4-3 .2-5-.5-7"/></svg>
        </div>
        <span>Paddy</span>
      </div>
      <div class="crop">
        <div class="crop-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21c1-7 1-13 1-17"/><path d="M13 6c1.5-1.5 3-1.5 4-3M13 10c1.8-.5 3.4-.2 5-2"/><ellipse cx="12" cy="4" rx="2" ry="1.4"/></svg>
        </div>
        <span>Areca Nut</span>
      </div>
      <div class="crop">
        <div class="crop-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 20c8 2 13-3 13-11-8 0-13 4-13 11z"/><path d="M6 20c2-4 4-7 8-10"/></svg>
        </div>
        <span>Banana</span>
      </div>
    </div>
  </div>

  <!-- HOW IT WORKS -->
  <section>
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Getting started</span>
        <h2>Set up your farm's ledger in four steps</h2>
      </div>
      <div class="steps">
        <div class="step">
          <span class="num">1 →</span>
          <h3>Sign up</h3>
          <p>Email, phone OTP, or Google — pick what's fastest for you.</p>
        </div>
        <div class="step">
          <span class="num">2 →</span>
          <h3>Add your farm</h3>
          <p>Location, size, and crops — takes under two minutes.</p>
        </div>
        <div class="step">
          <span class="num">3 →</span>
          <h3>Invite your managers</h3>
          <p>Just their name and phone number — they sign in themselves.</p>
        </div>
        <div class="step">
          <span class="num">4 →</span>
          <h3>Start logging</h3>
          <p>Attendance, expenses, harvest — or scan your old ledger to catch up.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- MANAGER SPOTLIGHT -->
  <section id="managers">
    <div class="wrap">
      <div class="manager-section">
        <div class="manager-grid">
          <div>
            <span class="eyebrow">Built for the field, not just the office</span>
            <h2>Your manager's phone becomes your ledger's front door.</h2>
            <p>Most farm software assumes one person enters all the data. Chiguru's Manager app lets the people actually in the field — your field managers and supervisors — record attendance and daily work themselves, the moment it happens.</p>
            <div class="manager-list">
              <div><span class="mark">→</span> No password to create, remember, or reset — just a phone number you add once</div>
              <div><span class="mark">→</span> A manager can only mark attendance and post work — nothing else on your farm's books</div>
              <div><span class="mark">→</span> Remove a manager instantly and their access is revoked the same second</div>
              <div><span class="mark">→</span> Every entry appears in your ledger in real time, from wherever you are</div>
            </div>
          </div>
          <div>
          <div class="manager-illustration" aria-hidden="true">
            <svg viewBox="0 0 300 170" fill="none">
              <circle class="sync-ring r1" cx="150" cy="70" r="26" stroke="#e0a83d" stroke-width="1.6"/>
              <circle class="sync-ring r2" cx="150" cy="70" r="26" stroke="#e0a83d" stroke-width="1.6"/>
              <circle class="sync-ring r3" cx="150" cy="70" r="26" stroke="#e0a83d" stroke-width="1.6"/>
              <path d="M117 168c2-16 10-27 22-32M183 168c-2-16-10-27-22-32" stroke="#a3b39d" stroke-width="2" stroke-linecap="round"/>
              <circle cx="150" cy="98" r="16" fill="#e6efe1"/>
              <rect x="140" y="60" width="20" height="34" rx="4" fill="#f0bd5c" stroke="#10190f" stroke-width="1.4"/>
              <rect x="143" y="65" width="14" height="20" rx="1.5" fill="#10190f" opacity="0.35"/>
              <path d="M96 100c10-6 18-6 24-2M204 100c-10-6-18-6-24-2" stroke="#a3b39d" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="phones">
            <div class="phone">
              <div class="phone-head">Manager App</div>
              <div class="phone-body">
                <p style="font-family: var(--font-display); font-size:0.95rem; margin-bottom:8px;">Sign in</p>
                <p style="color:#5b5670; margin-bottom:10px;">+91 98765 43210</p>
                <div class="phone-cta">Verify &amp; Continue</div>
              </div>
            </div>
            <div class="phone dim">
              <div class="phone-head">Manager App</div>
              <div class="phone-body">
                <p style="font-family: var(--font-display); font-size:0.95rem; margin-bottom:8px;">Today's Attendance</p>
                <div class="row"><span>Ramesh K.</span><span class="pill">Present</span></div>
                <div class="row"><span>Suresh P.</span><span class="pill">Present</span></div>
                <div class="row"><span>Group — Weeding</span><span class="pill">Synced</span></div>
                <div class="phone-cta">Mark Attendance</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- AI SPOTLIGHT -->
  <section id="ai">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Beyond record-keeping</span>
        <h2>An agronomist, a diagnostician, and a scribe — all in your pocket.</h2>
      </div>
      <div class="ai-grid">
        <div class="ai-card">
          <span class="eyebrow">Agri-AI Advisor</span>
          <h3>Ask, don't search</h3>
          <p>Describe a problem in plain language — pest pressure, irrigation timing, fertilizer schedule — and get advice grounded in your actual crop and farm data.</p>
        </div>
        <div class="ai-card">
          <span class="eyebrow">Disease Detection</span>
          <h3>Photograph a leaf, get a diagnosis</h3>
          <p>Point your camera at an affected plant. Chiguru identifies likely disease or deficiency and suggests next steps — often before it spreads.</p>
        </div>
        <div class="ai-card">
          <span class="eyebrow">Agri Doctor</span>
          <h3>Talk to a real agronomist</h3>
          <p>When AI isn't enough, book a consultation with a human Agri Doctor — chat or call, billed per session, no long-term commitment.</p>
        </div>
      </div>
      <div class="field-panel">
        <div>
          <span class="eyebrow">Worker Count</span>
          <h3>Point your camera at the picking line — get an instant headcount.</h3>
          <p>No manual tally at the end of a shift. Photograph your work group in the field and Chiguru's AI detects and counts every worker in the frame, ready to reconcile against attendance.</p>
        </div>
        <div class="field-canvas-wrap">
          <canvas id="fieldCanvas" width="600" height="360" aria-label="Illustration of an AI face-detection scan counting a lineup of field workers"></canvas>
          <div class="field-count-badge"><span class="dot"></span><span id="fieldCount">Detecting…</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- PRICING -->
  <section id="pricing">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Pricing</span>
        <h2>One ledger, three sizes.</h2>
        <p>Every plan includes the full Farm Accounts ledger, attendance, and AI tools. What scales is estates and manager seats.</p>
      </div>
      <div class="pricing-page">
        <div class="pricing-grid">
          <div class="price-col">
            <h3>Basic</h3>
            <div class="price-amount tabular">₹499<span> / month</span></div>
            <ul>
              <li><span class="mark">—</span>1 estate</li>
              <li><span class="mark">—</span>Full Farm Accounts ledger</li>
              <li><span class="mark">—</span>AI tools included</li>
              <li><span class="mark">—</span>No manager seats</li>
            </ul>
            <a class="btn btn-ghost" href="#" data-nav="auth">Choose Basic</a>
          </div>
          <div class="price-col featured">
            <span class="price-badge">Most Chosen</span>
            <h3>Premium</h3>
            <div class="price-amount tabular">₹999<span> / month</span></div>
            <ul>
              <li><span class="mark">—</span>Unlimited estates</li>
              <li><span class="mark">—</span>Full Farm Accounts ledger</li>
              <li><span class="mark">—</span>AI tools included</li>
              <li><span class="mark">—</span>2 manager seats included</li>
            </ul>
            <a class="btn btn-gold" href="#" data-nav="auth">Choose Premium</a>
          </div>
          <div class="price-col">
            <h3>Enterprise</h3>
            <div class="price-amount tabular">₹1,999<span> / month</span></div>
            <ul>
              <li><span class="mark">—</span>Unlimited estates</li>
              <li><span class="mark">—</span>Full Farm Accounts ledger</li>
              <li><span class="mark">—</span>AI tools included</li>
              <li><span class="mark">—</span>10 manager seats included</li>
            </ul>
            <a class="btn btn-ghost" href="#" data-nav="auth">Choose Enterprise</a>
          </div>
        </div>
        <div class="price-addon">
          <span>Need more managers on any plan?</span>
          <span><b class="tabular">₹199</b> / month per additional manager seat</span>
        </div>
      </div>
    </div>
  </section>

  <!-- FIELD PHOTO GALLERY (placeholders — swap in real, consent-cleared photos) -->
  <section>
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">On the ground</span>
        <h2>Real estates. Real work groups.</h2>
        <p>This is where your own field photos go — a picking line, a manager marking attendance, the harvest coming in.</p>
      </div>
      <div class="gallery-grid">
        <div class="gallery-tile">
          <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20600%20600%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%239c8a5c%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%233f6b4a%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22600%22%20height%3D%22600%22%20fill%3D%22url%28%23g%29%22/%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23f7f8f1%22%20stroke-width%3D%223%22%20opacity%3D%220.55%22%3E%3Crect%20x%3D%22195%22%20y%3D%22225%22%20width%3D%22210%22%20height%3D%22155%22%20rx%3D%228%22/%3E%3Ccircle%20cx%3D%22248%22%20cy%3D%22267%22%20r%3D%2217%22/%3E%3Cpath%20d%3D%22M195%20355l58-58%2042%2040%2058-72%2052%2068%22/%3E%3C/g%3E%3Ctext%20x%3D%22300%22%20y%3D%22432%22%20font-family%3D%22Georgia%2C%20serif%22%20font-size%3D%2220%22%20fill%3D%22%23f7f8f1%22%20text-anchor%3D%22middle%22%20opacity%3D%220.8%22%3EAdd%20your%20own%20photo%3C/text%3E%3C/svg%3E" alt="Placeholder — replace with a real photo of your work group lined up for the day">
          <div class="gallery-caption"><b>The work group</b>A full crew, ready for the day</div>
        </div>
        <div class="gallery-tile">
          <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20600%20600%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%239c8a5c%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%233f6b4a%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22600%22%20height%3D%22600%22%20fill%3D%22url%28%23g%29%22/%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23f7f8f1%22%20stroke-width%3D%223%22%20opacity%3D%220.55%22%3E%3Crect%20x%3D%22195%22%20y%3D%22225%22%20width%3D%22210%22%20height%3D%22155%22%20rx%3D%228%22/%3E%3Ccircle%20cx%3D%22248%22%20cy%3D%22267%22%20r%3D%2217%22/%3E%3Cpath%20d%3D%22M195%20355l58-58%2042%2040%2058-72%2052%2068%22/%3E%3C/g%3E%3Ctext%20x%3D%22300%22%20y%3D%22432%22%20font-family%3D%22Georgia%2C%20serif%22%20font-size%3D%2220%22%20fill%3D%22%23f7f8f1%22%20text-anchor%3D%22middle%22%20opacity%3D%220.8%22%3EAdd%20your%20own%20photo%3C/text%3E%3C/svg%3E" alt="Placeholder — replace with a real photo of a manager marking attendance in the field">
          <div class="gallery-caption"><b>Attendance, in the field</b>Marked the moment it happens</div>
        </div>
        <div class="gallery-tile">
          <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20600%20600%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%239c8a5c%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%233f6b4a%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22600%22%20height%3D%22600%22%20fill%3D%22url%28%23g%29%22/%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23f7f8f1%22%20stroke-width%3D%223%22%20opacity%3D%220.55%22%3E%3Crect%20x%3D%22195%22%20y%3D%22225%22%20width%3D%22210%22%20height%3D%22155%22%20rx%3D%228%22/%3E%3Ccircle%20cx%3D%22248%22%20cy%3D%22267%22%20r%3D%2217%22/%3E%3Cpath%20d%3D%22M195%20355l58-58%2042%2040%2058-72%2052%2068%22/%3E%3C/g%3E%3Ctext%20x%3D%22300%22%20y%3D%22432%22%20font-family%3D%22Georgia%2C%20serif%22%20font-size%3D%2220%22%20fill%3D%22%23f7f8f1%22%20text-anchor%3D%22middle%22%20opacity%3D%220.8%22%3EAdd%20your%20own%20photo%3C/text%3E%3C/svg%3E" alt="Placeholder — replace with a real photo of the harvest coming in">
          <div class="gallery-caption"><b>Harvest day</b>Weighed and logged before it leaves the field</div>
        </div>
        <div class="gallery-tile">
          <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20600%20600%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%239c8a5c%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%233f6b4a%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22600%22%20height%3D%22600%22%20fill%3D%22url%28%23g%29%22/%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23f7f8f1%22%20stroke-width%3D%223%22%20opacity%3D%220.55%22%3E%3Crect%20x%3D%22195%22%20y%3D%22225%22%20width%3D%22210%22%20height%3D%22155%22%20rx%3D%228%22/%3E%3Ccircle%20cx%3D%22248%22%20cy%3D%22267%22%20r%3D%2217%22/%3E%3Cpath%20d%3D%22M195%20355l58-58%2042%2040%2058-72%2052%2068%22/%3E%3C/g%3E%3Ctext%20x%3D%22300%22%20y%3D%22432%22%20font-family%3D%22Georgia%2C%20serif%22%20font-size%3D%2220%22%20fill%3D%22%23f7f8f1%22%20text-anchor%3D%22middle%22%20opacity%3D%220.8%22%3EAdd%20your%20own%20photo%3C/text%3E%3C/svg%3E" alt="Placeholder — replace with a real photo of the estate/farm landscape">
          <div class="gallery-caption"><b>The estate</b>Your land, your crops</div>
        </div>
      </div>
      <p class="gallery-swap-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
        Placeholder graphics — replace each with a real photo once you have consent from anyone identifiable in it.
      </p>
    </div>
  </section>

  <!-- PROOF -->
  <section>
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">From the field</span>
        <h2>What farm owners say</h2>
      </div>
      <div class="proof-grid">
        <div class="proof-card">
          <p class="quote">"I finally know if my coffee estate made money this season — not three months after harvest."</p>
          <p class="who">— Estate owner, Chikmagalur</p>
        </div>
        <div class="proof-card">
          <p class="quote">"My supervisor marks attendance from the field. I don't get the evening phone call anymore."</p>
          <p class="who">— Farm owner, Belagavi</p>
        </div>
        <div class="proof-card">
          <p class="quote">"I photographed ten years of my father's account books in an afternoon. All of it is searchable now."</p>
          <p class="who">— Smallholder farmer, Wayanad</p>
        </div>
      </div>
      <p class="proof-note">Placeholder quotes — swap in real testimonials before publishing</p>
    </div>
  </section>

  <!-- FAQ -->
  <section id="faq">
    <div class="wrap prose-wrap">
      <div class="section-head">
        <span class="eyebrow">Questions</span>
        <h2>Before you start</h2>
      </div>
      <div class="faq-list">
        <div class="faq-item">
          <button class="faq-q" data-faq-toggle>Does Chiguru work without internet in the field?<span class="plus">+</span></button>
          <div class="faq-a"><p>Yes. Attendance, expenses, and work updates are saved on the phone the moment they're entered, and sync automatically the next time there's a connection — nothing is lost to a dead zone.</p></div>
        </div>
        <div class="faq-item">
          <button class="faq-q" data-faq-toggle>Can I run more than one farm on one account?<span class="plus">+</span></button>
          <div class="faq-a"><p>Yes, on Premium and Enterprise. Add as many estates as you manage and switch between them from one sign-in — each keeps its own ledger, workers, and reports.</p></div>
        </div>
        <div class="faq-item">
          <button class="faq-q" data-faq-toggle>How does a manager sign in — do they need a password?<span class="plus">+</span></button>
          <div class="faq-a"><p>No password at all. You add their name and phone number from your account; they sign in with an OTP sent to that number. Removing them from your account revokes access immediately.</p></div>
        </div>
        <div class="faq-item">
          <button class="faq-q" data-faq-toggle>What happens to my data if I cancel?<span class="plus">+</span></button>
          <div class="faq-a"><p>Your account and login stay active — you simply lose access to estate creation, the ledger, attendance, and AI tools until you resubscribe. Nothing is deleted on cancellation.</p></div>
        </div>
        <div class="faq-item">
          <button class="faq-q" data-faq-toggle>Can I really digitize an old, handwritten account book?<span class="plus">+</span></button>
          <div class="faq-a"><p>Yes — photograph a page with your phone and Chiguru's AI reads labour costs, purchases, and sales, filing each entry into your ledger. You can review and correct anything it's unsure about before it's saved.</p></div>
        </div>
        <div class="faq-item">
          <button class="faq-q" data-faq-toggle>Is Chiguru only for farms in India?<span class="plus">+</span></button>
          <div class="faq-a"><p>Chiguru is built first for Indian smallholder and estate farms, but sign-in supports phone numbers from any country, so farms elsewhere can use it too.</p></div>
        </div>
      </div>
    </div>
  </section>

  <!-- FINAL CTA -->
  <section>
    <div class="wrap">
      <div class="final-cta">
        <h2>Your farm's ledger is one sign-up away.</h2>
        <p>Set up your first estate free, and see your records in one place today.</p>
        <div class="hero-ctas">
          <a class="btn btn-gold" href="#" data-nav="auth">Start Free</a>
        </div>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap footer-grid">
    <div>
      <a class="brand" href="#top" style="font-size:1.1rem;">Chiguru</a>
      <p style="margin-top:14px; color:var(--ink-soft); font-size:0.9rem; max-width:32ch;">Farm management for the field, not just the spreadsheet.</p>
    </div>
    <div class="footer-cols">
      <div class="footer-col">
        <h4>Product</h4>
        <a href="#features">Features</a>
        <a href="#managers">Manager App</a>
        <a href="#ai">AI Tools</a>
        <a href="#pricing">Pricing</a>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <a href="#">About</a>
        <a href="#">Contact</a>
        <a href="#">Careers</a>
      </div>
      <div class="footer-col">
        <h4>Legal</h4>
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
      </div>
    </div>
  </div>
  <div class="wrap footer-bottom">
    <span>© 2026 Chiguru. All rights reserved.</span>
    <span>Made for smallholder and estate farmers.</span>
  </div>
</footer>
`;

const LANDING_CSS = String.raw`
  :root {
    --ink: #1e4429;
    --ink-soft: #5a6b5a;
    --ground: #f7f8f1;
    --surface: #ffffff;
    --gold: #b9791a;
    --gold-strong: #96620f;
    --sprout: #3f9142;
    --rule: #d7dcc7;
    --rule-strong: #c0c7ac;
    --shadow: 0 1px 2px rgba(20, 34, 22, 0.07), 0 12px 32px -16px rgba(20, 34, 22, 0.2);

    --font-display: "Rockwell", "Roboto Slab", "Arvo", Georgia, "Times New Roman", serif;
    --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Consolas, "Liberation Mono", monospace;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --ink: #e6efe1;
      --ink-soft: #a3b39d;
      --ground: #10190f;
      --surface: #182417;
      --gold: #e0a83d;
      --gold-strong: #f0bd5c;
      --sprout: #6bc26e;
      --rule: #2a3627;
      --rule-strong: #3c4a37;
      --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 20px 40px -20px rgba(0, 0, 0, 0.65);
    }
  }

  #landing-root * { box-sizing: border-box; }
  #landing-root { scroll-behavior: smooth; background: var(--ground); color: var(--ink); font-family: var(--font-body); line-height: 1.55; -webkit-font-smoothing: antialiased; }
  @media (prefers-reduced-motion: reduce) {
    #landing-root { scroll-behavior: auto; }
    #landing-root * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
  }

  #landing-root h1, #landing-root h2, #landing-root h3 { font-family: var(--font-display); text-wrap: balance; margin: 0; color: var(--ink); }
  #landing-root p { margin: 0; }
  #landing-root a { color: inherit; }
  #landing-root .tabular { font-variant-numeric: tabular-nums; font-family: var(--font-mono); }

  #landing-root .wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  #landing-root .prose-wrap { max-width: 62ch; }

  #landing-root button { font-family: inherit; cursor: pointer; }
  #landing-root :focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }

  #landing-root .nav {
    position: sticky; top: 0; z-index: 40;
    background: color-mix(in srgb, var(--ground) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--rule);
  }
  #landing-root .nav-row { display: flex; align-items: center; justify-content: space-between; height: 68px; gap: 24px; }
  #landing-root .brand { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; letter-spacing: 0.01em; text-decoration: none; }
  #landing-root .brand-mark { width: 30px; height: 30px; flex-shrink: 0; }
  #landing-root .nav-links { display: flex; align-items: center; gap: 32px; font-size: 0.95rem; }
  #landing-root .nav-links a { text-decoration: none; color: var(--ink-soft); }
  #landing-root .nav-links a:hover { color: var(--ink); }
  #landing-root .nav-cta { display: flex; align-items: center; gap: 12px; }
  #landing-root .nav-toggle { display: none; background: none; border: none; padding: 8px; }
  #landing-root .nav-toggle svg { width: 22px; height: 22px; }

  @media (max-width: 860px) {
    #landing-root .nav-links { display: none; }
    #landing-root .nav-toggle { display: inline-flex; }
    #landing-root .nav-cta .btn-ghost { display: none; }
  }

  #landing-root .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 22px; border-radius: 3px; font-size: 0.95rem; font-weight: 600;
    text-decoration: none; border: 1px solid transparent; transition: transform 0.15s ease, box-shadow 0.15s ease;
    white-space: nowrap;
  }
  #landing-root .btn-gold { background: var(--gold); color: #fff8ea; }
  #landing-root .btn-gold:hover { background: var(--gold-strong); box-shadow: var(--shadow); }
  #landing-root .btn-ghost { background: transparent; color: var(--ink); border-color: var(--rule-strong); }
  #landing-root .btn-ghost:hover { border-color: var(--ink-soft); }
  #landing-root .btn-line { background: transparent; color: var(--ink); border-bottom: 2px solid var(--gold); border-radius: 0; padding: 4px 2px; }

  #landing-root section { padding: 96px 0; }
  #landing-root .eyebrow {
    display: inline-block; font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--gold-strong); margin-bottom: 14px;
  }
  #landing-root .section-head { max-width: 640px; margin-bottom: 56px; }
  #landing-root .section-head h2 { font-size: clamp(1.7rem, 3vw, 2.4rem); }
  #landing-root .section-head p { margin-top: 14px; color: var(--ink-soft); font-size: 1.05rem; }

  #landing-root .rule { border: none; border-top: 1px solid var(--rule); margin: 0; }

  #landing-root .hero { padding: 64px 0 100px; overflow: hidden; }
  #landing-root .hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 64px; align-items: center; }
  @media (max-width: 940px) { #landing-root .hero-grid { grid-template-columns: 1fr; gap: 48px; } }
  #landing-root .hero h1 { font-size: clamp(2.3rem, 4.6vw, 3.6rem); line-height: 1.08; letter-spacing: -0.01em; }
  #landing-root .hero .lede { margin-top: 22px; font-size: 1.15rem; color: var(--ink-soft); max-width: 46ch; }
  #landing-root .hero-ctas { display: flex; gap: 14px; margin-top: 34px; flex-wrap: wrap; }
  #landing-root .hero-trust { margin-top: 40px; display: flex; gap: 28px; flex-wrap: wrap; }
  #landing-root .hero-trust div { font-family: var(--font-mono); }
  #landing-root .hero-trust b { display: block; font-size: 1.5rem; color: var(--ink); }
  #landing-root .hero-trust span { font-size: 0.78rem; letter-spacing: 0.04em; color: var(--ink-soft); text-transform: uppercase; }

  #landing-root .ledger-canvas-wrap {
    position: relative; background: var(--surface); border: 1px solid var(--rule);
    border-radius: 4px; box-shadow: var(--shadow); padding: 22px 22px 26px;
  }
  #landing-root .ledger-canvas-wrap .tag {
    position: absolute; top: -13px; left: 22px; background: var(--ink); color: var(--ground);
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 5px 10px; border-radius: 2px;
  }
  #landing-root canvas#ledgerCanvas { width: 100%; height: auto; display: block; border-radius: 2px; }
  #landing-root .ledger-caption { margin-top: 14px; font-size: 0.85rem; color: var(--ink-soft); text-align: center; }

  #landing-root .split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; }
  @media (max-width: 860px) { #landing-root .split { grid-template-columns: 1fr; gap: 40px; } }
  #landing-root .split-card { padding: 30px; border-radius: 4px; }
  #landing-root .split-card.old { background: var(--surface); border: 1px dashed var(--rule-strong); }
  #landing-root .split-card.new { background: var(--ink); color: var(--ground); }
  #landing-root .split-card.new h3, #landing-root .split-card.new .eyebrow { color: var(--ground); }
  #landing-root .split-card h3 { font-size: 1.2rem; margin-bottom: 16px; }
  #landing-root .split-card ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; }
  #landing-root .split-card li { display: flex; gap: 10px; font-size: 0.98rem; }
  #landing-root .split-card.old li { color: var(--ink-soft); }
  #landing-root .split-card.new li { color: color-mix(in srgb, var(--ground) 88%, transparent); }
  #landing-root .split-card li .mark { flex-shrink: 0; width: 18px; text-align: center; font-family: var(--font-mono); }

  #landing-root .ledger { border-top: 1px solid var(--rule-strong); }
  #landing-root .ledger-row {
    display: grid; grid-template-columns: 56px 1fr; gap: 22px;
    padding: 30px 0; border-bottom: 1px solid var(--rule);
    align-items: start;
  }
  #landing-root .ledger-row:hover { background: color-mix(in srgb, var(--gold) 5%, transparent); }
  #landing-root .ledger-icon {
    width: 44px; height: 44px; border-radius: 3px; border: 1px solid var(--rule-strong);
    display: flex; align-items: center; justify-content: center; color: var(--sprout);
    background: var(--surface);
  }
  #landing-root .ledger-icon svg { width: 22px; height: 22px; }
  #landing-root .ledger-body h3 { font-size: 1.12rem; margin-bottom: 6px; }
  #landing-root .ledger-body p { color: var(--ink-soft); font-size: 0.97rem; max-width: 56ch; }
  #landing-root .ledger-tag {
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--gold-strong); margin-bottom: 8px; display: inline-block;
  }

  #landing-root .crop-strip { background: var(--surface); border-top: 1px solid var(--rule-strong); border-bottom: 1px solid var(--rule-strong); }
  #landing-root .crop-strip-inner { display: flex; justify-content: space-between; gap: 16px; padding: 40px 0; flex-wrap: wrap; }
  #landing-root .crop { display: flex; flex-direction: column; align-items: center; gap: 10px; flex: 1; min-width: 92px; }
  #landing-root .crop-icon {
    width: 64px; height: 64px; border-radius: 50%; border: 1px solid var(--rule-strong);
    display: flex; align-items: center; justify-content: center; background: var(--ground);
    color: var(--sprout); transform-origin: bottom center; animation: landingSway 5.5s ease-in-out infinite;
  }
  #landing-root .crop-icon svg { width: 30px; height: 30px; }
  #landing-root .crop:nth-child(2) .crop-icon { animation-delay: -0.9s; }
  #landing-root .crop:nth-child(3) .crop-icon { animation-delay: -1.8s; }
  #landing-root .crop:nth-child(4) .crop-icon { animation-delay: -2.7s; }
  #landing-root .crop:nth-child(5) .crop-icon { animation-delay: -3.6s; }
  #landing-root .crop span { font-family: var(--font-mono); font-size: 0.74rem; letter-spacing: 0.03em; color: var(--ink-soft); text-align: center; }
  @keyframes landingSway {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
  }

  #landing-root .roster { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  #landing-root .roster-person { position: relative; width: 40px; height: 40px; border-radius: 50%; background: var(--ground); border: 1px solid var(--rule-strong); display: flex; align-items: center; justify-content: center; color: var(--ink-soft); }
  #landing-root .roster-person svg { width: 20px; height: 20px; }
  #landing-root .roster-check {
    position: absolute; bottom: -4px; right: -4px; width: 16px; height: 16px; border-radius: 50%;
    background: var(--sprout); display: flex; align-items: center; justify-content: center;
    opacity: 0; transform: scale(0.4); animation: landingPopIn 0.35s ease forwards;
    animation-delay: calc(var(--i) * 0.18s + 0.3s); border: 2px solid var(--surface);
  }
  #landing-root .roster-check svg { width: 9px; height: 9px; stroke: var(--surface); stroke-width: 3; }
  @keyframes landingPopIn { to { opacity: 1; transform: scale(1); } }

  #landing-root .manager-illustration { display: flex; justify-content: center; margin-bottom: 28px; }
  #landing-root .manager-illustration svg { width: 100%; max-width: 300px; height: auto; }
  #landing-root .sync-ring { transform-origin: center; animation: landingSyncPulse 2.8s ease-out infinite; }
  #landing-root .sync-ring.r2 { animation-delay: 0.9s; }
  #landing-root .sync-ring.r3 { animation-delay: 1.8s; }
  @keyframes landingSyncPulse {
    0% { opacity: 0.55; transform: scale(0.6); }
    100% { opacity: 0; transform: scale(1.6); }
  }

  #landing-root .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border-top: 1px solid var(--rule-strong); border-bottom: 1px solid var(--rule-strong); }
  @media (max-width: 860px) { #landing-root .steps { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 520px) { #landing-root .steps { grid-template-columns: 1fr; } }
  #landing-root .step { padding: 28px 24px; border-right: 1px solid var(--rule); position: relative; }
  #landing-root .step:last-child { border-right: none; }
  #landing-root .step .num { font-family: var(--font-mono); color: var(--gold-strong); font-size: 0.85rem; margin-bottom: 14px; display: block; }
  #landing-root .step h3 { font-size: 1.02rem; margin-bottom: 8px; }
  #landing-root .step p { color: var(--ink-soft); font-size: 0.92rem; }

  #landing-root .manager-section { background: var(--ink); color: var(--ground); border-radius: 8px; padding: 72px 56px; }
  #landing-root .manager-section .eyebrow { color: var(--gold-strong); }
  #landing-root .manager-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
  @media (max-width: 860px) { #landing-root .manager-grid { grid-template-columns: 1fr; gap: 40px; } #landing-root .manager-section { padding: 56px 24px; } }
  #landing-root .manager-grid h2 { color: var(--ground); }
  #landing-root .manager-grid > div:first-child p { color: color-mix(in srgb, var(--ground) 78%, transparent); margin-top: 16px; font-size: 1.02rem; }
  #landing-root .manager-list { margin-top: 26px; display: flex; flex-direction: column; gap: 14px; }
  #landing-root .manager-list div { display: flex; gap: 12px; align-items: flex-start; font-size: 0.95rem; }
  #landing-root .manager-list .mark { color: var(--gold-strong); flex-shrink: 0; font-family: var(--font-mono); }

  #landing-root .phones { display: flex; gap: 18px; justify-content: center; }
  #landing-root .phone {
    width: 200px; border-radius: 22px; border: 6px solid #16241a; background: #f4f2ec; overflow: hidden;
    box-shadow: 0 30px 60px -24px rgba(0,0,0,0.55); color: #1e4429;
  }
  #landing-root .phone.dim { margin-top: 34px; }
  #landing-root .phone-head { background: var(--ink); color: var(--ground); font-size: 0.68rem; padding: 10px 12px; font-family: var(--font-mono); letter-spacing: 0.04em; }
  #landing-root .phone-body { padding: 14px 12px; font-size: 0.72rem; }
  #landing-root .phone-body .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #e4dfd0; }
  #landing-root .phone-body .pill { display: inline-block; background: #e7f1e9; color: #2f6b40; border-radius: 20px; padding: 2px 8px; font-size: 0.62rem; font-family: var(--font-mono); }
  #landing-root .phone-cta { margin-top: 10px; background: #b9791a; color: #fff8ea; text-align: center; padding: 8px; border-radius: 4px; font-size: 0.68rem; font-weight: 700; }

  #landing-root .ai-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--rule-strong); border: 1px solid var(--rule-strong); }
  @media (max-width: 860px) { #landing-root .ai-grid { grid-template-columns: 1fr; } }
  #landing-root .ai-card { background: var(--surface); padding: 32px; }
  #landing-root .ai-card .eyebrow { display: block; }
  #landing-root .ai-card h3 { font-size: 1.1rem; margin: 10px 0 10px; }
  #landing-root .ai-card p { color: var(--ink-soft); font-size: 0.94rem; }

  #landing-root .field-panel {
    margin-top: 1px; background: var(--surface); border: 1px solid var(--rule-strong); border-top: none;
    padding: 32px; display: grid; grid-template-columns: 1fr 1.3fr; gap: 32px; align-items: center;
  }
  @media (max-width: 780px) { #landing-root .field-panel { grid-template-columns: 1fr; } }
  #landing-root .field-panel .eyebrow { display: block; }
  #landing-root .field-panel h3 { font-size: 1.25rem; margin: 10px 0 12px; }
  #landing-root .field-panel p { color: var(--ink-soft); font-size: 0.96rem; max-width: 42ch; }
  #landing-root .field-canvas-wrap { position: relative; border-radius: 4px; overflow: hidden; border: 1px solid var(--rule-strong); box-shadow: var(--shadow); }
  #landing-root canvas#fieldCanvas { width: 100%; height: auto; display: block; }
  #landing-root .field-count-badge {
    position: absolute; top: 12px; right: 12px; background: rgba(16,25,15,0.82); color: #eef5ea;
    font-family: var(--font-mono); font-size: 0.78rem; padding: 6px 12px; border-radius: 20px;
    display: flex; align-items: center; gap: 7px; letter-spacing: 0.02em;
  }
  #landing-root .field-count-badge .dot { width: 7px; height: 7px; border-radius: 50%; background: #6bc26e; animation: landingDotPulse 1.6s ease-in-out infinite; }
  @keyframes landingDotPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

  #landing-root .pricing-page { border: 1px solid var(--rule-strong); border-radius: 4px; overflow: hidden; background: var(--surface); }
  #landing-root .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 860px) { #landing-root .pricing-grid { grid-template-columns: 1fr; } }
  #landing-root .price-col { padding: 40px 32px; border-right: 1px solid var(--rule); position: relative; }
  #landing-root .price-col:last-child { border-right: none; }
  @media (max-width: 860px) { #landing-root .price-col { border-right: none; border-bottom: 1px solid var(--rule); } #landing-root .price-col:last-child { border-bottom: none; } }
  #landing-root .price-col.featured { background: color-mix(in srgb, var(--gold) 7%, var(--surface)); }
  #landing-root .price-badge {
    position: absolute; top: 18px; right: 18px; font-family: var(--font-mono); font-size: 0.64rem;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--gold-strong); border: 1px solid var(--gold-strong);
    padding: 3px 8px; border-radius: 20px;
  }
  #landing-root .price-col h3 { font-size: 1.15rem; }
  #landing-root .price-amount { margin-top: 18px; font-family: var(--font-mono); font-size: 2.1rem; color: var(--ink); }
  #landing-root .price-amount span { font-size: 0.95rem; color: var(--ink-soft); font-family: var(--font-body); }
  #landing-root .price-col ul { list-style: none; margin: 26px 0 30px; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  #landing-root .price-col li { font-size: 0.92rem; color: var(--ink-soft); display: flex; gap: 10px; }
  #landing-root .price-col li .mark { color: var(--sprout); font-family: var(--font-mono); flex-shrink: 0; }
  #landing-root .price-col .btn { width: 100%; }
  #landing-root .price-addon {
    border-top: 1px solid var(--rule); padding: 22px 32px; display: flex; justify-content: space-between;
    align-items: center; flex-wrap: wrap; gap: 12px; font-size: 0.92rem; color: var(--ink-soft);
  }
  #landing-root .price-addon b { color: var(--ink); font-family: var(--font-mono); font-weight: 600; }

  #landing-root .proof-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
  @media (max-width: 860px) { #landing-root .proof-grid { grid-template-columns: 1fr; } }
  #landing-root .proof-card { border: 1px solid var(--rule); border-radius: 4px; padding: 26px; background: var(--surface); }
  #landing-root .proof-card p.quote { font-family: var(--font-display); font-size: 1.05rem; line-height: 1.5; }
  #landing-root .proof-card .who { margin-top: 18px; font-size: 0.85rem; color: var(--ink-soft); font-family: var(--font-mono); }
  #landing-root .proof-note { margin-top: 18px; font-size: 0.78rem; color: var(--ink-soft); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.05em; }

  #landing-root .gallery-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 14px; height: 480px; }
  @media (max-width: 860px) { #landing-root .gallery-grid { grid-template-columns: 1fr 1fr; grid-template-rows: repeat(4, 220px); height: auto; } }
  @media (max-width: 560px) { #landing-root .gallery-grid { grid-template-columns: 1fr; grid-template-rows: repeat(4, 240px); } }
  #landing-root .gallery-tile:nth-child(1) { grid-row: 1 / 3; }
  @media (max-width: 860px) { #landing-root .gallery-tile:nth-child(1) { grid-row: auto; grid-column: 1 / 3; } }
  @media (max-width: 560px) { #landing-root .gallery-tile:nth-child(1) { grid-column: auto; } }
  #landing-root .gallery-tile {
    position: relative; border-radius: 4px; overflow: hidden; border: 1px solid var(--rule-strong);
    background: var(--surface);
  }
  #landing-root .gallery-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  #landing-root .gallery-caption {
    position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 16px;
    background: linear-gradient(to top, rgba(16,25,15,0.82), transparent);
    color: #eef5ea; font-size: 0.86rem; font-family: var(--font-mono); letter-spacing: 0.01em;
  }
  #landing-root .gallery-caption b { display: block; font-family: var(--font-display); font-size: 1.02rem; margin-bottom: 2px; letter-spacing: 0; }
  #landing-root .gallery-swap-note {
    margin-top: 20px; font-size: 0.8rem; color: var(--ink-soft); font-family: var(--font-mono);
    display: flex; align-items: center; gap: 8px;
  }
  #landing-root .gallery-swap-note svg { width: 14px; height: 14px; flex-shrink: 0; }

  #landing-root .faq-item { border-bottom: 1px solid var(--rule); }
  #landing-root .faq-q {
    width: 100%; background: none; border: none; text-align: left; padding: 22px 0;
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    font-family: var(--font-display); font-size: 1.05rem; color: var(--ink);
  }
  #landing-root .faq-q .plus { font-family: var(--font-mono); font-size: 1.2rem; color: var(--gold-strong); transition: transform 0.2s ease; flex-shrink: 0; }
  #landing-root .faq-item[data-open="true"] .plus { transform: rotate(45deg); }
  #landing-root .faq-a { max-height: 0; overflow: hidden; transition: max-height 0.25s ease; }
  #landing-root .faq-a p { padding: 0 0 22px; color: var(--ink-soft); font-size: 0.96rem; max-width: 62ch; }

  #landing-root .final-cta { background: var(--ink); border-radius: 8px; padding: 72px 40px; text-align: center; }
  #landing-root .final-cta h2 { color: var(--ground); font-size: clamp(1.7rem, 3vw, 2.3rem); }
  #landing-root .final-cta p { color: color-mix(in srgb, var(--ground) 80%, transparent); margin-top: 14px; }
  #landing-root .final-cta .hero-ctas { justify-content: center; margin-top: 30px; }

  #landing-root footer { border-top: 1px solid var(--rule); padding: 48px 0; }
  #landing-root .footer-grid { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 32px; }
  #landing-root .footer-cols { display: flex; gap: 56px; flex-wrap: wrap; }
  #landing-root .footer-col h4 { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 14px; }
  #landing-root .footer-col a { display: block; font-size: 0.92rem; color: var(--ink-soft); text-decoration: none; padding: 5px 0; }
  #landing-root .footer-col a:hover { color: var(--ink); }
  #landing-root .footer-bottom { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--rule); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 0.82rem; color: var(--ink-soft); }

  #landing-root .mobile-sheet {
    position: fixed; inset: 0; z-index: 50; background: var(--ground); display: none;
    flex-direction: column; padding: 24px;
  }
  #landing-root .mobile-sheet.open { display: flex; }
  #landing-root .mobile-sheet-head { display: flex; justify-content: space-between; align-items: center; }
  #landing-root .mobile-sheet nav { margin-top: 40px; display: flex; flex-direction: column; gap: 4px; }
  #landing-root .mobile-sheet nav a { padding: 16px 4px; border-bottom: 1px solid var(--rule); text-decoration: none; color: var(--ink); font-family: var(--font-display); font-size: 1.2rem; }
  #landing-root .mobile-sheet .btn { margin-top: 28px; }
`;

interface LandingProps {
  onGetStarted: () => void;
}

export default function Landing({ onGetStarted }: LandingProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest(
        "[data-nav='auth'], [data-open-mobile-nav], [data-close-mobile-nav], [data-faq-toggle]",
      ) as HTMLElement | null;
      if (!target) return;

      if (target.matches("[data-nav='auth']")) {
        e.preventDefault();
        onGetStarted();
        return;
      }
      if (target.matches("[data-open-mobile-nav]")) {
        root!.querySelector("#mobileSheet")?.classList.add("open");
        return;
      }
      if (target.matches("[data-close-mobile-nav]")) {
        root!.querySelector("#mobileSheet")?.classList.remove("open");
        return;
      }
      if (target.matches("[data-faq-toggle]")) {
        const item = target.closest(".faq-item");
        if (!item) return;
        const answer = item.querySelector(".faq-a") as HTMLElement | null;
        const isOpen = item.getAttribute("data-open") === "true";
        root!.querySelectorAll(".faq-item").forEach((el) => {
          el.setAttribute("data-open", "false");
          (el.querySelector(".faq-a") as HTMLElement | null)?.style.setProperty("max-height", "");
        });
        if (!isOpen && answer) {
          item.setAttribute("data-open", "true");
          answer.style.maxHeight = answer.scrollHeight + 40 + "px";
        }
      }
    }

    root.addEventListener("click", handleClick);

    const cleanups: Array<() => void> = [];
    cleanups.push(() => root.removeEventListener("click", handleClick));

    // --- Ledger-scan hero animation ---
    const ledgerCanvas = root.querySelector<HTMLCanvasElement>("#ledgerCanvas");
    if (ledgerCanvas) {
      const ctx = ledgerCanvas.getContext("2d")!;
      const W = ledgerCanvas.width;
      const H = ledgerCanvas.height;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const rows = [
        { label: "Weeding — Grp A", val: "₹ 1,200" },
        { label: "Urea 50kg", val: "₹ 640" },
        { label: "Coffee — 1st pick", val: "42 kg" },
        { label: "Diesel — pumpset", val: "₹ 300" },
        { label: "Loan repay — Ramesh", val: "₹ 2,000" },
        { label: "Pepper — harvest", val: "18 kg" },
        { label: "Spray labour", val: "₹ 900" },
      ];

      function isDark() {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      function draw(progress: number) {
        const dark = isDark();
        const paper = dark ? "#182417" : "#fbfbf3";
        const ruleColor = dark ? "#3c4a37" : "#e2e6d3";
        const inkColor = dark ? "#e6efe1" : "#1e4429";
        const softColor = dark ? "#a3b39d" : "#5a6b5a";
        const goldColor = dark ? "#e0a83d" : "#b9791a";
        const sproutColor = dark ? "#6bc26e" : "#3f9142";

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, W, H);

        const marginX = 36, top = 34, rowH = 46;
        ctx.strokeStyle = ruleColor;
        ctx.lineWidth = 1;
        for (let r = 0; r <= rows.length; r++) {
          const y = top + r * rowH;
          ctx.beginPath();
          ctx.moveTo(marginX, y);
          ctx.lineTo(W - marginX, y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(W - 150, top);
        ctx.lineTo(W - 150, top + rows.length * rowH);
        ctx.stroke();

        const visibleRows = Math.floor(progress * (rows.length + 1));
        const partial = progress * (rows.length + 1) - visibleRows;

        for (let i = 0; i < rows.length; i++) {
          const y0 = top + i * rowH;
          const reveal = i < visibleRows ? 1 : i === visibleRows ? partial : 0;
          if (reveal <= 0) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(marginX, y0, (W - marginX * 2) * reveal, rowH);
          ctx.clip();
          ctx.fillStyle = inkColor;
          ctx.font = "600 15px Georgia, serif";
          ctx.fillText(rows[i].label, marginX + 14, y0 + rowH / 2 + 5);
          ctx.fillStyle = sproutColor;
          ctx.font = "600 15px ui-monospace, Consolas, monospace";
          ctx.textAlign = "right";
          ctx.fillText(rows[i].val, W - 160, y0 + rowH / 2 + 5);
          ctx.textAlign = "left";
          ctx.restore();
        }

        if (progress < 1) {
          const scanY = top + progress * rows.length * rowH;
          const grad = ctx.createLinearGradient(0, scanY - 14, 0, scanY + 14);
          grad.addColorStop(0, "rgba(184,140,30,0)");
          grad.addColorStop(0.5, dark ? "rgba(224,168,61,0.35)" : "rgba(185,121,26,0.28)");
          grad.addColorStop(1, "rgba(184,140,30,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(marginX, scanY - 14, W - marginX * 2, 28);
          ctx.strokeStyle = goldColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(marginX, scanY);
          ctx.lineTo(W - marginX, scanY);
          ctx.stroke();
        }

        ctx.fillStyle = softColor;
        ctx.font = "700 11px ui-monospace, Consolas, monospace";
        ctx.textAlign = "left";
        ctx.fillText("ENTRY", marginX + 14, top - 12);
        ctx.textAlign = "right";
        ctx.fillText("AMOUNT / QTY", W - 160, top - 12);
        ctx.textAlign = "left";
      }

      let rafId: number | null = null;
      if (reduceMotion) {
        draw(1);
      } else {
        let start: number | null = null;
        const duration = 2600;
        const frame = (ts: number) => {
          if (!start) start = ts;
          const elapsed = ts - start;
          const progress = Math.min(1, elapsed / duration);
          draw(progress);
          if (progress < 1) rafId = requestAnimationFrame(frame);
        };
        rafId = requestAnimationFrame(frame);
      }

      const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const onSchemeChange = () => draw(1);
      darkModeQuery.addEventListener("change", onSchemeChange);
      cleanups.push(() => {
        if (rafId) cancelAnimationFrame(rafId);
        darkModeQuery.removeEventListener("change", onSchemeChange);
      });
    }

    // --- Field worker-count scene ---
    const fieldCanvas = root.querySelector<HTMLCanvasElement>("#fieldCanvas");
    const fieldCountEl = root.querySelector<HTMLElement>("#fieldCount");
    if (fieldCanvas && fieldCountEl) {
      const countEl = fieldCountEl;
      const ctx = fieldCanvas.getContext("2d")!;
      const W = fieldCanvas.width;
      const H = fieldCanvas.height;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const wardrobe = ["#c96b3d", "#d8b23c", "#3f6b8a", "#8a3f5a", "#6b8a3f", "#b04a3d", "#4a5a8a", "#a06b2f"];
      const n = 9;
      const spacing = (W - 80) / (n - 1);
      const people = Array.from({ length: n }, (_, i) => {
        const h = 118 + Math.sin(i * 1.7) * 14 + (i % 3 === 0 ? 10 : 0);
        return {
          x: 60 + i * spacing,
          headR: 15 + (i % 2) * 2,
          bodyH: h,
          bodyW: 34 + (i % 2) * 6,
          wardrobe: wardrobe[i % wardrobe.length],
        };
      });

      function isDark() {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      function drawScene(progress: number) {
        const dark = isDark();
        ctx.clearRect(0, 0, W, H);

        const sky = ctx.createLinearGradient(0, 0, 0, H);
        if (dark) {
          sky.addColorStop(0, "#233420");
          sky.addColorStop(0.55, "#2c3d24");
          sky.addColorStop(1, "#3a2f22");
        } else {
          sky.addColorStop(0, "#7fa66b");
          sky.addColorStop(0.5, "#9c8a5c");
          sky.addColorStop(1, "#b06a45");
        }
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = dark ? "rgba(20,40,18,0.5)" : "rgba(30,60,25,0.28)";
        for (let t = 0; t < 22; t++) {
          const tx = (t * 47 + 13) % W;
          const ty = 20 + Math.sin(t) * 14;
          ctx.beginPath();
          ctx.ellipse(tx, ty, 34, 22, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = dark ? "#1c2a19" : "#a9754a";
        ctx.fillRect(0, H - 70, W, 70);
        ctx.strokeStyle = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
        ctx.lineWidth = 1;
        for (let g = 0; g < W; g += 26) {
          ctx.beginPath();
          ctx.moveTo(g, H - 70);
          ctx.lineTo(g - 10, H);
          ctx.stroke();
        }

        const detected = Math.floor(progress * (n + 1));

        people.forEach((p, idx) => {
          const baseY = H - 70;
          const bodyTop = baseY - p.bodyH;
          const headCy = bodyTop - p.headR + 4;

          ctx.fillStyle = dark ? "#0f1712" : "#241a12";
          ctx.beginPath();
          ctx.moveTo(p.x - p.bodyW / 2, baseY);
          ctx.lineTo(p.x - p.bodyW / 2 + 5, bodyTop);
          ctx.lineTo(p.x + p.bodyW / 2 - 5, bodyTop);
          ctx.lineTo(p.x + p.bodyW / 2, baseY);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = p.wardrobe;
          ctx.fillRect(p.x - p.bodyW / 2 + 2, bodyTop, p.bodyW - 4, 14);

          ctx.fillStyle = dark ? "#2a1d14" : "#3d2a1a";
          ctx.beginPath();
          ctx.arc(p.x, headCy, p.headR, 0, Math.PI * 2);
          ctx.fill();

          if (idx < detected) {
            const boxPad = 9;
            ctx.strokeStyle = "#e0a83d";
            ctx.lineWidth = 1.6;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(p.x - p.headR - boxPad, headCy - p.headR - boxPad, (p.headR + boxPad) * 2, (p.headR + boxPad) * 2);
            ctx.setLineDash([]);

            ctx.fillStyle = "#6bc26e";
            ctx.beginPath();
            ctx.arc(p.x + p.headR + boxPad - 2, headCy - p.headR - boxPad + 2, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#0f1712";
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(p.x + p.headR + boxPad - 5, headCy - p.headR - boxPad + 2);
            ctx.lineTo(p.x + p.headR + boxPad - 2.5, headCy - p.headR - boxPad + 4.5);
            ctx.lineTo(p.x + p.headR + boxPad + 1.5, headCy - p.headR - boxPad - 1.5);
            ctx.stroke();
          }
        });

        countEl.textContent = detected >= n ? `${n} workers counted` : `Detecting… ${detected}/${n}`;
      }

      let rafId2: number | null = null;
      if (reduceMotion) {
        drawScene(1);
      } else {
        let start: number | null = null;
        const duration = 2200;
        const frame = (ts: number) => {
          if (!start) start = ts;
          const progress = Math.min(1, (ts - start) / duration);
          drawScene(progress);
          if (progress < 1) rafId2 = requestAnimationFrame(frame);
        };
        rafId2 = requestAnimationFrame(frame);
      }

      const darkModeQuery2 = window.matchMedia("(prefers-color-scheme: dark)");
      const onSchemeChange2 = () => drawScene(1);
      darkModeQuery2.addEventListener("change", onSchemeChange2);
      cleanups.push(() => {
        if (rafId2) cancelAnimationFrame(rafId2);
        darkModeQuery2.removeEventListener("change", onSchemeChange2);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, [onGetStarted]);

  return (
    <div id="landing-root" ref={rootRef}>
      <style>{LANDING_CSS}</style>
      <div dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
    </div>
  );
}
