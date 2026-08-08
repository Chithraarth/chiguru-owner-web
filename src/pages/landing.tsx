import { useEffect, useRef } from "react";

// Marketing landing page shown to signed-out visitors, ahead of the sign-in
// gate in App.tsx. Body markup is injected as raw HTML (not JSX) because it
// carries its own self-contained CSS/animation design that doesn't map onto
// the app's Tailwind/shadcn setup — see the <style> block below.
// "Sign In" links to /login, every "Start Free"/pricing/footer CTA links to
// /signup (both real, deep-linkable routes handled in App.tsx) via onNavigate;
// every other link is an in-page anchor or an in-page Terms/Privacy toggle
// (data-page).
//
// Pricing shown here (Basic/Premium/Pro) is kept in sync BY HAND with the
// real plans seeded in subscription_plans on the backend (see
// chiguru-backend src/db/schema/subscriptions.ts) — all three plans unlock
// the same features via requireActiveSubscription; they differ only in how
// many managers are included. Update both places together if prices change.
const LANDING_HTML = String.raw`
<div id="progressBar" class="progress-bar"></div>

<nav class="nav">
  <div class="wrap nav-row">
    <a class="brand" href="#top" data-page="landing">Chiguru</a>
    <div class="nav-links">
      <a href="#features-section">Features</a>
      <a href="#how-it-works">How it works</a>
      <a href="#pricing-section">Pricing</a>
      <a href="#faq-section">FAQ</a>
    </div>
    <div class="nav-cta">
      <select class="lang-select"><option>English</option></select>
      <a class="btn btn-ghost btn-nav" href="/login" data-nav="login">Sign In</a>
      <a class="btn btn-primary btn-nav" href="/signup" data-nav="signup">Sign Up</a>
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
    <a href="#features-section" data-close-mobile-nav>Features</a>
    <a href="#how-it-works" data-close-mobile-nav>How it works</a>
    <a href="#pricing-section" data-close-mobile-nav>Pricing</a>
    <a href="#faq-section" data-close-mobile-nav>FAQ</a>
  </nav>
  <div class="mobile-sheet-ctas">
    <a class="btn btn-primary" href="/signup" data-nav="signup">Start free — 30 days →</a>
    <a class="btn btn-ghost" href="/login" data-nav="login">Sign In</a>
  </div>
</div>

<div id="page-landing">
<main id="top">

  <section class="hero" id="hero">
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <div class="badge"><span class="dot"></span>Trusted by 25,000+ farmers across India</div>
        <h1>Run your entire farm from your phone.</h1>
        <div class="hero-tagline">Manage workers · Track money · Grow better.</div>
        <p class="lede">One simple app that handles attendance, accounts, AI crop advice and your farm's marketplace — all in your language.</p>
        <div class="hero-ctas">
          <a class="btn btn-primary btn-magnet" href="/signup" data-nav="signup" id="magnetBtn">Start free — 30 days →</a>
          <a class="btn btn-ghost" href="#pricing-section">See plans</a>
        </div>
        <div class="hero-trust">
          <div class="avatar-stack">
            <span class="avatar" style="background:#6E56CF;">R</span>
            <span class="avatar" style="background:#22C55E;">L</span>
            <span class="avatar" style="background:#C9A227;">M</span>
          </div>
          <div class="rating"><span class="stars">★★★★★</span> 4.8 · 25,000+ farmers</div>
        </div>
      </div>

      <div class="hero-visual" id="heroVisual">
        <div class="phone" id="phone">
          <div class="phone-inner">
            <div class="phone-bar"></div>
            <div class="phone-body">
              <div class="phone-title">Your farm today</div>
              <div class="phone-hero-tile"></div>
              <div class="phone-row">
                <div class="phone-chip chip-a"></div>
                <div class="phone-chip chip-b"></div>
              </div>
              <div class="phone-block"></div>
              <div class="phone-block"></div>
            </div>
          </div>
        </div>

        <div class="float-card fc-1" data-float>
          {{ICON_CAMERA}}
          <div><div class="fc-title">Attendance marked</div><div class="fc-sub">Ravi · 9:02 AM</div></div>
        </div>
        <div class="float-card fc-2" data-float>
          {{ICON_WALLET}}
          <div><div class="fc-title">₹12,400 this week</div><div class="fc-sub">Expenses</div></div>
        </div>
        <div class="float-card fc-3" data-float>
          {{ICON_STETHO}}
          <div><div class="fc-title">Leaf disease found</div><div class="fc-sub">AI Doctor</div></div>
        </div>
        <div class="float-card fc-4" data-float>
          {{ICON_STORE}}
          <div><div class="fc-title">3 new offers</div><div class="fc-sub">Marketplace</div></div>
        </div>
        <div class="float-card fc-5" data-float>
          {{ICON_CLOUD}}
          <div><div class="fc-title">32° · Sunny</div><div class="fc-sub">Weather</div></div>
        </div>
        <div class="float-card fc-6" data-float>
          {{ICON_BASKET}}
          <div><div class="fc-title">180kg coffee</div><div class="fc-sub">Harvest</div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="reveal" data-reveal>
    <div class="wrap stats-grid">
      <div class="stat-card"><div class="stat-num" data-count="25000" data-suffix="+">0+</div><div class="stat-label">Farmers</div></div>
      <div class="stat-card"><div class="stat-num" data-count="2000000" data-suffix="+">0+</div><div class="stat-label">Attendance records</div></div>
      <div class="stat-card"><div class="stat-num" data-count="50" data-suffix="+">0+</div><div class="stat-label">Villages</div></div>
      <div class="stat-card"><div class="stat-num" data-count="99.9" data-decimal="1" data-suffix="%">0%</div><div class="stat-label">Uptime</div></div>
    </div>
  </section>

  <section class="reveal" id="features-section" data-reveal>
    <div class="wrap">
      <div class="section-head">
        <h2>Everything your farm needs</h2>
        <p>From attendance to AI crop advice, one app replaces the notebook, the phone calls and the guesswork.</p>
      </div>
      <div class="bento">
        <div class="bento-tile bento-big">
          <div>{{ICON_LEAF_WHITE}}</div>
          <div>
            <div class="bento-title">AI disease detection</div>
            <div class="bento-desc">Photograph a sick leaf and get an instant diagnosis with the right treatment to spray.</div>
          </div>
        </div>
        <div class="bento-tile">{{ICON_CAMERA}}<div class="bento-title-sm">Attendance</div><div class="bento-desc-sm">Face-photo check-in, no cheating.</div></div>
        <div class="bento-tile">{{ICON_PHOTO}}<div class="bento-title-sm">Daily reports</div><div class="bento-desc-sm">Photos of the day's work, from anywhere.</div></div>
        <div class="bento-tile bento-wide bento-green">{{ICON_STORE_G}}<div><div class="bento-title-sm">Marketplace</div><div class="bento-desc-sm bento-desc-green">Sell produce, plants and equipment straight from the app.</div></div></div>
        <div class="bento-tile">{{ICON_TRUCK}}<div class="bento-title-sm">Equipment rental</div><div class="bento-desc-sm">Rent or list tractors, JCBs and sprayers.</div></div>
        <div class="bento-tile">{{ICON_PEOPLE}}<div class="bento-title-sm">Find workers</div><div class="bento-desc-sm">Post or browse labourers near you.</div></div>
        <div class="bento-tile">{{ICON_WALLET}}<div class="bento-title-sm">Finance</div><div class="bento-desc-sm">Clear profit and loss for your farm.</div></div>
        <div class="bento-tile">{{ICON_CHAT}}<div class="bento-title-sm">AI advisor</div><div class="bento-desc-sm">Ask any farming question, in your language.</div></div>
      </div>
    </div>
  </section>

  <section class="reveal how-section" id="how-it-works" data-reveal>
    <div class="wrap">
      <div class="section-head">
        <h2>How it works</h2>
        <p>Five simple steps from setting up your farm to growing it with AI and the marketplace.</p>
      </div>
      <div class="how-row">
        <div class="how-card" data-reveal-item>
          <div class="how-badge">01</div>
          <div class="how-icon" style="background:linear-gradient(135deg,#6E56CF,#8B7AE0);">{{ICON_SPROUT_WHITE}}</div>
          <div class="how-title">Create your farm</div>
          <div class="how-desc">Add your farm, crops and workers in a few minutes.</div>
        </div>
        <div class="how-card" data-reveal-item>
          <div class="how-badge">02</div>
          <div class="how-icon" style="background:linear-gradient(135deg,#7A5FD1,#6E56CF);">{{ICON_PEOPLE_WHITE}}</div>
          <div class="how-title">Invite workers</div>
          <div class="how-desc">Add labourers and managers so they show up in the app.</div>
        </div>
        <div class="how-card" data-reveal-item>
          <div class="how-badge">03</div>
          <div class="how-icon" style="background:linear-gradient(135deg,#5B8FD6,#6E56CF);">{{ICON_CAMERA_WHITE}}</div>
          <div class="how-title">Daily attendance</div>
          <div class="how-desc">Face-photo check-in, no paperwork, no disputes.</div>
        </div>
        <div class="how-card" data-reveal-item>
          <div class="how-badge">04</div>
          <div class="how-icon" style="background:linear-gradient(135deg,#3FB894,#22C55E);">{{ICON_WALLET_WHITE}}</div>
          <div class="how-title">Track income</div>
          <div class="how-desc">See accounts, wages and profit and loss in one place.</div>
        </div>
        <div class="how-card" data-reveal-item>
          <div class="how-badge">05</div>
          <div class="how-icon" style="background:linear-gradient(135deg,#22C55E,#4ADE80);">{{ICON_LEAF_WHITE}}</div>
          <div class="how-title">Grow better</div>
          <div class="how-desc">Use AI advice, rent equipment and sell what you grow.</div>
        </div>
      </div>
    </div>
  </section>

  <section class="reveal" data-reveal>
    <div class="wrap">
      <h2 class="center-h2">Watch and learn</h2>
      <div class="video-row">
        <div class="video-card" data-reveal-item>
          <div class="video-thumb" style="background:linear-gradient(135deg,#6E56CF,#8B7AE0);">
            <span class="video-tag">Getting started</span>
            <span class="video-dur">2:14</span>
            <span class="pulse-ring"></span>
            <span class="play-btn">{{ICON_PLAY}}</span>
          </div>
          <div class="video-body"><div class="video-title">Walk around the app</div><div class="video-desc">A short tour of every screen — attendance, work updates and accounts.</div></div>
        </div>
        <div class="video-card" data-reveal-item>
          <div class="video-thumb" style="background:linear-gradient(135deg,#2E2A54,#4A3F8C);">
            <span class="video-tag">Marketplace</span>
            <span class="video-dur">3:05</span>
            <span class="pulse-ring"></span>
            <span class="play-btn">{{ICON_PLAY}}</span>
          </div>
          <div class="video-body"><div class="video-title">How to rent machines, find workers and sell</div><div class="video-desc">Post an ad, rent a tractor or JCB, find labourers, and sell your produce.</div></div>
        </div>
        <div class="video-card" data-reveal-item>
          <div class="video-thumb" style="background:linear-gradient(135deg,#22C55E,#4ADE80);">
            <span class="video-tag">Stories</span>
            <span class="video-dur">1:48</span>
            <span class="pulse-ring"></span>
            <span class="play-btn">{{ICON_PLAY}}</span>
          </div>
          <div class="video-body"><div class="video-title">Why farmers love Chiguru</div><div class="video-desc">How the app keeps your farm maintained and accounts correct.</div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="reveal market-section" data-reveal>
    <div class="wrap">
      <div class="section-head">
        <h2>Sell what you grow</h2>
        <p>Produce, plants or equipment — list it once and reach buyers near you.</p>
      </div>
      <div class="market-row">
        <div class="market-card" data-reveal-item>
          <div class="market-icon" style="background:linear-gradient(135deg,#6E56CF,#8B7AE0);">{{ICON_STORE_WHITE}}</div>
          <div class="market-title">Sell your produce</div>
          <div class="market-desc">Coffee, pepper, arecanut, vegetables — sell your farm's produce in the market.</div>
          <div class="market-link" style="color:#6E56CF;">Explore →</div>
        </div>
        <div class="market-card" data-reveal-item>
          <div class="market-icon" style="background:linear-gradient(135deg,#22C55E,#4ADE80);">{{ICON_SPROUT_WHITE}}</div>
          <div class="market-title">Sell nursery plants</div>
          <div class="market-desc">Open your own nursery shop and sell plants and saplings.</div>
          <div class="market-link" style="color:#1B9950;">Explore →</div>
        </div>
        <div class="market-card" data-reveal-item>
          <div class="market-icon" style="background:linear-gradient(135deg,#C9A227,#E0BE55);">{{ICON_WRENCH_WHITE}}</div>
          <div class="market-title">Sell farm equipment</div>
          <div class="market-desc">List your machines and tools for sale or rent, and earn from them.</div>
          <div class="market-link" style="color:#A8801E;">Explore →</div>
        </div>
      </div>
    </div>
  </section>

  <section class="reveal ai-section" data-reveal>
    <div class="ai-particle ap-1"></div>
    <div class="ai-particle ap-2"></div>
    <div class="ai-particle ap-3"></div>
    <div class="ai-particle ap-4"></div>
    <div class="wrap ai-grid">
      <div class="ai-copy">
        <div class="ai-pill">AI-powered</div>
        <h2>Ask your farm anything.</h2>
        <p>Take a photo of a sick crop, ask a question in your own language, or talk to a real agri doctor when you need one.</p>
        <div class="ai-tags">
          <span class="ai-tag">{{ICON_LEAF_TINY}} AI disease check</span>
          <span class="ai-tag">{{ICON_CHAT_TINY}} AI agri advisor</span>
          <span class="ai-tag">{{ICON_STETHO_TINY}} Talk to a doctor</span>
        </div>
      </div>
      <div class="ai-console">
        <div class="ai-console-label">You ask</div>
        <div class="ai-console-text"><span id="aiTypedText"></span><span class="ai-cursor">|</span></div>
      </div>
    </div>
  </section>

  <section class="reveal" data-reveal>
    <div class="wrap">
      <h2 class="center-h2">Farmers who use Chiguru</h2>
      <div class="testi-row">
        <div class="testi-card" data-reveal-item>
          <div class="testi-stars">★★★★★</div>
          <div class="testi-quote">"Wage disputes stopped completely once workers could see their own attendance."</div>
          <div class="testi-who"><span class="testi-avatar" style="background:#6E56CF;">R</span><div><div class="testi-name">Ravi Kumar</div><div class="testi-role">Coffee grower, Chikkamagaluru</div></div></div>
        </div>
        <div class="testi-card" data-reveal-item>
          <div class="testi-stars">★★★★★</div>
          <div class="testi-quote">"I check my farm's accounts from my phone even when I am travelling."</div>
          <div class="testi-who"><span class="testi-avatar" style="background:#22C55E;">L</span><div><div class="testi-name">Lakshmi Devi</div><div class="testi-role">Areca farmer, Shivamogga</div></div></div>
        </div>
        <div class="testi-card" data-reveal-item>
          <div class="testi-stars">★★★★☆</div>
          <div class="testi-quote">"The AI told me my leaf disease in seconds. I sprayed the right medicine and saved my crop."</div>
          <div class="testi-who"><span class="testi-avatar" style="background:#C9A227;">M</span><div><div class="testi-name">Manjunath</div><div class="testi-role">Pepper farmer, Kodagu</div></div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="reveal" id="pricing-section" data-reveal>
    <div class="wrap wrap-narrow">
      <div class="section-head">
        <h2>Simple pricing</h2>
        <p>Every plan runs your whole farm — attendance, accounts, AI advisor and marketplace. Pick the manager seats you need.</p>
      </div>
      <div class="plans-row">
        <div class="plan-card" data-reveal-item>
          <div class="plan-name">Basic</div>
          <div class="plan-price"><span class="plan-amount">₹499</span><span class="plan-period">/month</span></div>
          <div class="plan-note">For a single farm getting started.</div>
          <div class="plan-features">
            <div class="plan-feat">{{ICON_CHECK}}<span>Attendance, accounts &amp; AI advisor</span></div>
            <div class="plan-feat">{{ICON_CHECK}}<span>Marketplace access</span></div>
            <div class="plan-feat">{{ICON_CHECK}}<span>1 manager included</span></div>
          </div>
          <a class="btn btn-ghost plan-cta" href="/signup" data-nav="signup">Start free — 30 days →</a>
        </div>
        <div class="plan-card plan-featured" data-reveal-item>
          <div class="plan-badge">Most popular</div>
          <div class="plan-name plan-name-on-dark">Premium</div>
          <div class="plan-price"><span class="plan-amount plan-amount-on-dark">₹999</span><span class="plan-period plan-period-on-dark">/month</span></div>
          <div class="plan-note plan-note-on-dark">For a growing operation with more managers.</div>
          <div class="plan-features">
            <div class="plan-feat plan-feat-on-dark">{{ICON_CHECK_LIGHT}}<span>Everything in Basic</span></div>
            <div class="plan-feat plan-feat-on-dark">{{ICON_CHECK_LIGHT}}<span>5 managers included</span></div>
            <div class="plan-feat plan-feat-on-dark">{{ICON_CHECK_LIGHT}}<span>Priority support</span></div>
          </div>
          <a class="btn plan-cta plan-cta-on-dark" href="/signup" data-nav="signup">Start free — 30 days →</a>
        </div>
        <div class="plan-card" data-reveal-item>
          <div class="plan-name">Pro</div>
          <div class="plan-price"><span class="plan-amount">₹1,999</span><span class="plan-period">/month</span></div>
          <div class="plan-note">For large operations needing the most manager seats.</div>
          <div class="plan-features">
            <div class="plan-feat">{{ICON_CHECK}}<span>Everything in Premium</span></div>
            <div class="plan-feat">{{ICON_CHECK}}<span>10 managers included</span></div>
            <div class="plan-feat">{{ICON_CHECK}}<span>Dedicated support</span></div>
          </div>
          <a class="btn btn-ghost plan-cta" href="/signup" data-nav="signup">Talk to us →</a>
        </div>
      </div>
      <div class="plans-footnote">Every plan starts with a free 30-day trial. No card required.</div>
    </div>
  </section>

  <section class="reveal" id="faq-section" data-reveal>
    <div class="wrap wrap-faq">
      <h2 class="center-h2">Frequently asked questions</h2>
      <div class="faq-item" data-open="false">
        <div class="faq-q" data-faq-toggle><span>Do I need internet to use Chiguru?</span><span class="faq-chevron">+</span></div>
        <div class="faq-a">Most features work offline in the field and sync when you're back online.</div>
      </div>
      <div class="faq-item" data-open="false">
        <div class="faq-q" data-faq-toggle><span>What if my workers don't have smartphones?</span><span class="faq-chevron">+</span></div>
        <div class="faq-a">Only the farm owner or manager needs a phone. Workers are marked present by a manager's camera.</div>
      </div>
      <div class="faq-item" data-open="false">
        <div class="faq-q" data-faq-toggle><span>Can I use Chiguru in my own language?</span><span class="faq-chevron">+</span></div>
        <div class="faq-a">Yes. The app works in Kannada, Telugu, Tamil, Hindi and English, and reads text aloud.</div>
      </div>
      <div class="faq-item" data-open="false">
        <div class="faq-q" data-faq-toggle><span>What happens after the free 30 days?</span><span class="faq-chevron">+</span></div>
        <div class="faq-a">You move to one simple monthly plan. No hidden charges.</div>
      </div>
      <div class="faq-item" data-open="false">
        <div class="faq-q" data-faq-toggle><span>Is my farm's data safe?</span><span class="faq-chevron">+</span></div>
        <div class="faq-a">Yes. See our Privacy Policy for details on how we handle your data.</div>
      </div>
    </div>
  </section>

  <section class="reveal" data-reveal>
    <div class="wrap wrap-narrow">
      <div class="cta-glow">
        <div class="cta-title">Start managing your farm today</div>
        <div class="cta-sub">30-day free trial. No card required.</div>
        <a class="btn btn-cta" href="/signup" data-nav="signup">Start free — 30 days →</a>
      </div>
    </div>
  </section>

</main>
</div>

<div id="page-terms" class="legal-page">
  <div class="wrap wrap-legal">
    <a href="#" data-page="landing" class="legal-back">← Back to Chiguru</a>
    <h1>Terms of Service</h1>
    <p class="legal-date">Effective Date: August 6, 2026</p>

    <h2>1. Acceptance of Terms</h2>
    <p>By creating an account or using the Chiguru app, you agree to these Terms of Service. If you do not agree, please do not use the app.</p>

    <h2>2. Using Chiguru</h2>
    <p>Chiguru is provided to help you manage attendance, wages, farm accounts, crop advice and marketplace listings. You agree to use the app only for lawful purposes and to provide accurate information about your farm, workers and transactions.</p>

    <h2>3. Accounts and Security</h2>
    <p>You are responsible for keeping your login details secure and for all activity that happens under your account. Tell us right away if you suspect unauthorized access.</p>

    <h2>4. Subscription and Payments</h2>
    <p>New accounts get a 30-day free trial. After the trial, continued use requires an active monthly subscription. Fees are billed in advance and are non-refundable except where required by law. We will notify you before any price change takes effect.</p>

    <h2>5. Marketplace Listings</h2>
    <p>When you list produce, plants or equipment for rent or sale, you are responsible for the accuracy of your listing and for agreements you make with buyers, sellers or renters. Chiguru connects farmers and does not guarantee the outcome of any transaction.</p>

    <h2>6. AI Features Disclaimer</h2>
    <p>The AI disease check and AI agri advisor provide general guidance and are not a substitute for professional agricultural or veterinary advice. Use your own judgment, and consult a qualified expert for serious or urgent crop issues.</p>

    <h2>7. Your Data and Privacy</h2>
    <p>Our <a href="#" data-page="privacy">Privacy Policy</a> explains what information we collect, including face photos used for attendance, and how we use and protect it.</p>

    <h2>8. Termination</h2>
    <p>You may stop using Chiguru and cancel your subscription at any time. We may suspend or close accounts that violate these terms or misuse the app.</p>

    <h2>9. Limitation of Liability</h2>
    <p>Chiguru is provided as a farm management tool. To the extent permitted by law, we are not liable for losses arising from crop outcomes, missed reminders, third-party transactions, or connectivity issues in the field.</p>

    <h2>10. Changes to These Terms</h2>
    <p>We may update these terms from time to time. We will let you know about significant changes in the app before they take effect.</p>

    <h2>11. Contact</h2>
    <p>Questions about these terms? Contact us at <a href="mailto:support@chiguru.app">support@chiguru.app</a>.</p>
  </div>
</div>

<div id="page-privacy" class="legal-page">
  <div class="wrap wrap-legal">
    <a href="#" data-page="landing" class="legal-back">← Back to Chiguru</a>
    <h1>Privacy Policy</h1>
    <p class="legal-date">Effective Date: August 6, 2026</p>

    <h2>1. Information We Collect</h2>
    <p>We collect information you provide when you set up your farm and workers, such as names, phone numbers, wage rates, farm location, and photos used for attendance and daily work updates. We also collect usage data to keep the app working well.</p>

    <h2>2. How We Use Your Information</h2>
    <p>We use your information to run attendance and wage calculations, keep your accounts, connect you with the marketplace, provide AI crop guidance, and improve the app.</p>

    <h2>3. Face Photos and Biometric Data</h2>
    <p>Face photos are used only to mark and verify worker attendance. They are stored securely and are not sold or used for any purpose other than attendance and the features you enable.</p>

    <h2>4. Location Data</h2>
    <p>We may use your farm's location to show nearby workers, machines and marketplace listings. You can control location access from your phone's settings.</p>

    <h2>5. Data Sharing</h2>
    <p>We do not sell your personal data. We share information only with service providers who help us run the app, with other users when you choose to list something or contact them, or when required by law.</p>

    <h2>6. Data Security</h2>
    <p>We use industry-standard measures to protect your data, including encryption in transit and restricted access to sensitive information such as face photos and financial records.</p>

    <h2>7. Your Rights</h2>
    <p>You can review, correct, or request deletion of your data at any time by contacting us. Deleting your account removes your personal data, subject to records we must legally keep.</p>

    <h2>8. Children's Privacy</h2>
    <p>Chiguru is intended for farm owners, managers and adult workers. We do not knowingly collect personal data from children.</p>

    <h2>9. Changes to This Policy</h2>
    <p>We may update this policy as the app changes. We will notify you of significant changes in the app.</p>

    <h2>10. Contact Us</h2>
    <p>Questions about your data? Contact us at <a href="mailto:privacy@chiguru.app">privacy@chiguru.app</a>.</p>
  </div>
</div>

<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <div class="footer-logo">Chiguru</div>
      <div class="footer-tag">One app to run your whole farm.</div>
    </div>
    <div class="footer-col">
      <div class="footer-head">PRODUCT</div>
      <a href="#features-section">Features</a>
      <a href="#pricing-section">Pricing</a>
      <a href="/signup" data-nav="signup">Open app</a>
    </div>
    <div class="footer-col">
      <div class="footer-head">COMPANY</div>
      <a href="#">About</a>
      <a href="#">Contact</a>
    </div>
    <div class="footer-col">
      <div class="footer-head">LEGAL</div>
      <a href="#" data-page="terms">Terms of Service</a>
      <a href="#" data-page="privacy">Privacy Policy</a>
    </div>
    <div class="footer-col">
      <div class="footer-head">GET THE APP</div>
      <div class="footer-store">{{ICON_PHONE_TINY}} App Store</div>
      <div class="footer-store">{{ICON_PHONE_TINY}} Google Play</div>
    </div>
  </div>
  <div class="footer-bottom">© 2026 Chiguru. Made for farmers.</div>
</footer>
`;

const LANDING_CSS = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

#landing-root {
  --violet: #6E56CF;
  --indigo: #2E2A54;
  --green: #22C55E;
  --gold: #C9A227;
  --ink: #1A1830;
  --ink-soft: #4A4660;
  --muted: #6B6880;
  --faint: #8A8794;
  --bg: #FAFAFC;
  --card-border: rgba(46,42,84,0.08);
  font-family: 'IBM Plex Sans', sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  overflow-x: hidden;
}
#landing-root * { box-sizing: border-box; }
#landing-root a { color: var(--violet); text-decoration: none; }
#landing-root a:hover { color: var(--indigo); text-decoration: underline; }
#landing-root h1, #landing-root h2 { font-family: 'Sora', sans-serif; color: var(--ink); }
#landing-root .wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
#landing-root .wrap-narrow { max-width: 900px; }
#landing-root .wrap-faq { max-width: 720px; }
#landing-root .wrap-legal { max-width: 700px; padding: 48px 24px 64px; }
#landing-root .center-h2 { font-size: 32px; font-weight: 800; text-align: center; margin: 0 0 28px; }
#landing-root .section-head { text-align: center; max-width: 560px; margin: 0 auto 32px; }
#landing-root .section-head h2 { font-size: 34px; font-weight: 800; margin: 0 0 10px; }
#landing-root .section-head p { font-size: 15.5px; color: var(--muted); line-height: 1.6; margin: 0; }

@keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
@keyframes blink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }
@keyframes blobDrift { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-24px) scale(1.08); } 100% { transform: translate(0,0) scale(1); } }
@keyframes pulseRing { 0% { transform: scale(1); opacity: .55; } 100% { transform: scale(1.7); opacity: 0; } }

/* progress bar */
#landing-root .progress-bar { position: fixed; top: 0; left: 0; height: 3px; width: 0%; background: linear-gradient(90deg,var(--violet),var(--green)); z-index: 100; transition: width .1s linear; }

/* nav */
#landing-root .nav { position: sticky; top: 0; z-index: 50; background: rgba(250,250,252,0.75); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(46,42,84,0.08); }
#landing-root .nav-row { padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
#landing-root .brand { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 20px; color: var(--ink); cursor: pointer; text-decoration: none; }
#landing-root .brand:hover { text-decoration: none; color: var(--ink); }
#landing-root .nav-links { display: flex; gap: 24px; }
#landing-root .nav-links a { color: var(--ink-soft); font-size: 14px; font-weight: 500; }
#landing-root .nav-links a:hover { color: var(--indigo); }
#landing-root .nav-cta { display: flex; align-items: center; gap: 16px; }
#landing-root .lang-select { border: 1px solid rgba(46,42,84,0.15); border-radius: 8px; padding: 7px 10px; background: #fff; font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; color: var(--ink); }
#landing-root .nav-toggle { display: none; background: none; border: none; color: var(--ink); cursor: pointer; padding: 6px; }

#landing-root .mobile-sheet { position: fixed; inset: 0 0 0 auto; width: min(320px, 84vw); background: #fff; z-index: 60; transform: translateX(100%); transition: transform .25s ease; display: flex; flex-direction: column; padding: 20px; box-shadow: -20px 0 50px -20px rgba(26,24,48,0.3); }
#landing-root .mobile-sheet.open { transform: translateX(0); }
#landing-root .mobile-sheet-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
#landing-root .mobile-sheet nav { display: flex; flex-direction: column; gap: 18px; margin-bottom: 24px; }
#landing-root .mobile-sheet nav a { color: var(--ink); font-weight: 500; font-size: 15px; }
#landing-root .mobile-sheet-ctas { display: flex; flex-direction: column; gap: 10px; }

/* buttons */
#landing-root .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px; border-radius: 28px; padding: 16px 26px; transition: transform .2s ease, background .2s ease; cursor: pointer; }
#landing-root .btn:hover { text-decoration: none; }
#landing-root .btn-primary { background: var(--indigo); color: #fff; }
#landing-root .btn-primary:hover { background: #1F1C3D; color: #fff; }
#landing-root .btn-ghost { background: #fff; border: 1px solid rgba(46,42,84,0.15); color: var(--ink); }
#landing-root .btn-ghost:hover { transform: scale(1.04); color: var(--ink); }
#landing-root .btn-cta { background: #fff; color: var(--indigo); font-weight: 700; }
#landing-root .btn-cta:hover { transform: scale(1.05); color: var(--indigo); }
#landing-root .btn-nav { padding: 10px 18px; font-size: 14px; }
#landing-root .btn-magnet { will-change: transform; box-shadow: 0 14px 30px -12px rgba(46,42,84,0.5); }

/* hero */
#landing-root .hero { position: relative; overflow: hidden; padding: 76px 24px 40px; }
#landing-root .blob { position: absolute; border-radius: 50%; filter: blur(10px); z-index: 0; animation: blobDrift 10s ease-in-out infinite; }
#landing-root .blob-1 { top: -120px; left: -100px; width: 420px; height: 420px; background: radial-gradient(circle,#6E56CF55,transparent 70%); }
#landing-root .blob-2 { top: 60px; right: -140px; width: 460px; height: 460px; background: radial-gradient(circle,#22C55E33,transparent 70%); animation-duration: 12s; }
#landing-root .hero-grid { position: relative; z-index: 1; display: flex; gap: 48px; align-items: center; flex-wrap: wrap; }
#landing-root .hero-copy { flex: 1; min-width: 320px; }
#landing-root .badge { display: inline-flex; align-items: center; gap: 8px; background: #fff; border: 1px solid rgba(46,42,84,0.1); border-radius: 999px; padding: 7px 14px; font-size: 13px; color: var(--ink-soft); margin-bottom: 20px; box-shadow: 0 4px 14px -8px rgba(46,42,84,0.2); }
#landing-root .badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); }
#landing-root .hero h1 { font-weight: 800; font-size: 56px; line-height: 1.08; margin: 0 0 16px; text-wrap: pretty; }
#landing-root .hero-tagline { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 19px; color: var(--violet); margin-bottom: 14px; }
#landing-root .hero .lede { font-size: 17px; line-height: 1.65; color: #5B5867; max-width: 520px; margin: 0 0 28px; text-wrap: pretty; }
#landing-root .hero-ctas { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 22px; }
#landing-root .hero-trust { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
#landing-root .avatar-stack { display: flex; }
#landing-root .avatar { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--bg); color: #fff; font-size: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; margin-left: -10px; }
#landing-root .avatar-stack .avatar:first-child { margin-left: 0; }
#landing-root .rating { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--ink-soft); }
#landing-root .stars { color: var(--gold); }

#landing-root .hero-visual { flex: 1; min-width: 320px; display: flex; justify-content: center; position: relative; }
#landing-root .phone { position: relative; width: 250px; height: 510px; background: var(--ink); border-radius: 38px; padding: 12px; box-shadow: 0 40px 70px -30px rgba(26,24,48,0.45); transition: transform .2s ease-out; }
#landing-root .phone-inner { width: 100%; height: 100%; background: #fff; border-radius: 28px; overflow: hidden; position: relative; }
#landing-root .phone-bar { height: 26px; background: var(--indigo); }
#landing-root .phone-body { padding: 16px; }
#landing-root .phone-title { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 13px; color: var(--ink); margin-bottom: 12px; }
#landing-root .phone-hero-tile { height: 60px; border-radius: 12px; background: linear-gradient(135deg,var(--violet),#8B7AE0); margin-bottom: 10px; }
#landing-root .phone-row { display: flex; gap: 8px; margin-bottom: 10px; }
#landing-root .phone-chip { flex: 1; height: 44px; border-radius: 10px; }
#landing-root .chip-a { background: #F1EFF9; }
#landing-root .chip-b { background: #EAFBEF; }
#landing-root .phone-block { height: 70px; border-radius: 12px; background: #F5F4FA; margin-bottom: 10px; }
#landing-root .float-card { position: absolute; background: rgba(255,255,255,0.75); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.6); border-radius: 14px; padding: 10px 14px; box-shadow: 0 14px 30px -14px rgba(46,42,84,0.3); display: flex; align-items: center; gap: 8px; transition: transform .2s ease-out; animation: floatY 4s ease-in-out infinite; }
#landing-root .fc-1 { top: 20px; left: -30px; }
#landing-root .fc-2 { top: 130px; right: -36px; animation-duration: 4.4s; animation-delay: .3s; }
#landing-root .fc-3 { top: 280px; left: -42px; animation-duration: 3.8s; animation-delay: .6s; }
#landing-root .fc-4 { top: 390px; right: -30px; animation-duration: 4.2s; animation-delay: .9s; }
#landing-root .fc-5 { top: -10px; right: 60px; animation-duration: 3.6s; animation-delay: 1.2s; }
#landing-root .fc-6 { bottom: 20px; left: 70px; animation-duration: 4.6s; animation-delay: .4s; }
#landing-root .fc-title { font-size: 11.5px; font-weight: 600; color: var(--ink); }
#landing-root .fc-sub { font-size: 10.5px; color: var(--faint); }

/* reveal-on-scroll */
#landing-root .reveal { opacity: 0; transform: translateY(24px); transition: opacity .7s ease, transform .7s ease; }
#landing-root .reveal.revealed { opacity: 1; transform: translateY(0); }
#landing-root [data-reveal-item] { opacity: 0; transform: translateY(18px); transition: opacity .6s ease, transform .6s ease; }
#landing-root .revealed [data-reveal-item] { opacity: 1; transform: translateY(0); }
#landing-root .revealed [data-reveal-item]:nth-child(1) { transition-delay: 0ms; }
#landing-root .revealed [data-reveal-item]:nth-child(2) { transition-delay: 90ms; }
#landing-root .revealed [data-reveal-item]:nth-child(3) { transition-delay: 180ms; }
#landing-root .revealed [data-reveal-item]:nth-child(4) { transition-delay: 270ms; }
#landing-root .revealed [data-reveal-item]:nth-child(5) { transition-delay: 360ms; }

/* stats */
#landing-root .stats-grid { display: flex; flex-wrap: wrap; gap: 16px; padding: 24px 0 40px; }
#landing-root .stat-card { flex: 1; min-width: 180px; background: #fff; border: 1px solid var(--card-border); border-radius: 18px; padding: 26px; text-align: center; box-shadow: 0 10px 26px -16px rgba(46,42,84,0.15); }
#landing-root .stat-num { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 32px; color: var(--indigo); }
#landing-root .stat-label { font-size: 13px; color: var(--muted); margin-top: 4px; }

/* bento features */
#landing-root .bento { display: grid; grid-template-columns: repeat(4,1fr); grid-auto-rows: 180px; gap: 16px; padding: 40px 0 8px; }
#landing-root .bento-tile { background: #fff; border: 1px solid var(--card-border); border-radius: 20px; padding: 22px; transition: transform .3s ease, box-shadow .3s ease; }
#landing-root .bento-tile:hover { transform: translateY(-6px); box-shadow: 0 20px 40px -20px rgba(46,42,84,0.25); }
#landing-root .bento-big { grid-column: 1 / 3; grid-row: 1 / 3; background: linear-gradient(160deg,var(--indigo),#4A3F8C); border-radius: 22px; padding: 28px; color: #fff; display: flex; flex-direction: column; justify-content: space-between; }
#landing-root .bento-big:hover { box-shadow: 0 26px 50px -20px rgba(46,42,84,0.55); }
#landing-root .bento-title { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 19px; margin-bottom: 6px; }
#landing-root .bento-desc { font-size: 14px; opacity: .85; line-height: 1.55; max-width: 340px; }
#landing-root .bento-title-sm { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 15px; margin: 12px 0 4px; }
#landing-root .bento-desc-sm { font-size: 13px; color: var(--muted); line-height: 1.5; }
#landing-root .bento-wide { grid-column: 3 / 5; grid-row: 2; display: flex; align-items: center; gap: 16px; }
#landing-root .bento-green { background: linear-gradient(135deg,#EAFBEF,#F5FFF7); border-color: rgba(34,197,94,0.2); }
#landing-root .bento-green:hover { box-shadow: 0 20px 40px -20px rgba(34,197,94,0.3); }
#landing-root .bento-desc-green { color: #3F6B4E; }

/* how it works */
#landing-root .how-section { background: linear-gradient(180deg,#F5F3FF,var(--bg)); }
#landing-root .how-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: stretch; padding: 64px 0 56px; }
#landing-root .how-card { flex: 1; min-width: 190px; background: #fff; border: 1px solid var(--card-border); border-radius: 20px; padding: 24px 20px; box-shadow: 0 14px 30px -22px rgba(46,42,84,0.2); position: relative; transition: transform .3s ease, box-shadow .3s ease; }
#landing-root .how-card:hover { transform: translateY(-6px); box-shadow: 0 22px 40px -20px rgba(46,42,84,0.28); }
#landing-root .how-badge { position: absolute; top: 16px; right: 16px; font-family: 'Sora', sans-serif; font-weight: 700; font-size: 12px; color: #C7C3DA; }
#landing-root .how-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
#landing-root .how-title { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 16px; margin-bottom: 6px; }
#landing-root .how-desc { font-size: 13.5px; color: var(--muted); line-height: 1.55; }

/* videos */
#landing-root .video-row { display: flex; gap: 20px; flex-wrap: wrap; padding: 0 0 8px; }
#landing-root .video-card { flex: 1; min-width: 280px; background: #fff; border: 1px solid var(--card-border); border-radius: 20px; overflow: hidden; box-shadow: 0 14px 32px -20px rgba(46,42,84,0.2); }
#landing-root .video-thumb { height: 180px; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; transition: transform .35s ease; cursor: pointer; }
#landing-root .video-thumb:hover { transform: scale(1.04); }
#landing-root .video-tag { position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,0.9); border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 600; color: var(--indigo); }
#landing-root .video-dur { position: absolute; bottom: 12px; right: 12px; background: rgba(26,24,48,0.7); color: #fff; border-radius: 6px; padding: 3px 8px; font-size: 11px; }
#landing-root .pulse-ring { position: absolute; width: 58px; height: 58px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.8); animation: pulseRing 1.8s ease-out infinite; }
#landing-root .play-btn { width: 58px; height: 58px; border-radius: 50%; background: rgba(255,255,255,0.92); display: flex; align-items: center; justify-content: center; }
#landing-root .video-body { padding: 18px 20px; }
#landing-root .video-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
#landing-root .video-desc { font-size: 13.5px; color: var(--muted); line-height: 1.5; }

/* market */
#landing-root .market-section { background: linear-gradient(180deg,#F3FBF5,var(--bg)); }
#landing-root .market-row { display: flex; flex-wrap: wrap; gap: 18px; padding: 0 0 24px; }
#landing-root .market-card { flex: 1; min-width: 240px; background: #fff; border: 1px solid var(--card-border); border-radius: 22px; padding: 28px; transition: transform .3s ease, box-shadow .3s ease; }
#landing-root .market-card:hover { transform: translateY(-8px); box-shadow: 0 26px 48px -22px rgba(46,42,84,0.28); }
#landing-root .market-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
#landing-root .market-title { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 17px; margin-bottom: 6px; }
#landing-root .market-desc { font-size: 13.5px; color: var(--muted); line-height: 1.6; margin-bottom: 16px; }
#landing-root .market-link { font-size: 13.5px; font-weight: 600; }

/* AI section */
#landing-root .ai-section { background: linear-gradient(160deg,var(--ink),var(--indigo)); position: relative; overflow: hidden; padding: 64px 24px; }
#landing-root .ai-particle { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #8B7AE0; animation: floatY 3s ease-in-out infinite; }
#landing-root .ap-1 { top: 20%; left: 10%; }
#landing-root .ap-2 { top: 60%; left: 22%; width: 4px; height: 4px; background: var(--green); animation-duration: 3.4s; animation-delay: .5s; }
#landing-root .ap-3 { top: 30%; right: 16%; width: 5px; height: 5px; animation-duration: 2.8s; animation-delay: .2s; }
#landing-root .ap-4 { top: 75%; right: 28%; width: 4px; height: 4px; background: var(--gold); animation-duration: 3.6s; animation-delay: .8s; }
#landing-root .ai-grid { position: relative; z-index: 1; display: flex; gap: 40px; align-items: center; flex-wrap: wrap; max-width: 900px; }
#landing-root .ai-copy { flex: 1; min-width: 280px; color: #fff; }
#landing-root .ai-pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.08); border-radius: 999px; padding: 6px 14px; font-size: 12.5px; margin-bottom: 16px; }
#landing-root .ai-copy h2 { font-weight: 800; font-size: 30px; margin: 0 0 14px; line-height: 1.2; color: #fff; }
#landing-root .ai-copy p { font-size: 15px; color: #C7C3DA; line-height: 1.65; margin: 0 0 20px; max-width: 400px; }
#landing-root .ai-tags { display: flex; flex-wrap: wrap; gap: 10px; }
#landing-root .ai-tag { background: rgba(255,255,255,0.08); border-radius: 999px; padding: 8px 14px; font-size: 13px; display: flex; align-items: center; gap: 6px; color: #fff; }
#landing-root .ai-console { flex: 1; min-width: 280px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 22px; min-height: 110px; }
#landing-root .ai-console-label { font-size: 11px; color: #8B85A6; margin-bottom: 10px; }
#landing-root .ai-console-text { font-size: 15px; color: #fff; line-height: 1.6; min-height: 48px; }
#landing-root .ai-cursor { animation: blink 1s step-end infinite; }

/* testimonials */
#landing-root .testi-row { display: flex; flex-wrap: wrap; gap: 20px; padding: 0 0 8px; }
#landing-root .testi-card { flex: 1; min-width: 260px; display: flex; flex-direction: column; background: #fff; border: 1px solid var(--card-border); border-radius: 22px; padding: 28px; box-shadow: 0 16px 36px -24px rgba(46,42,84,0.22); }
#landing-root .testi-stars { color: var(--gold); font-size: 15px; margin-bottom: 14px; }
#landing-root .testi-quote { font-size: 15px; line-height: 1.6; color: #3F3C4A; margin-bottom: 22px; flex: 1; }
#landing-root .testi-who { display: flex; align-items: center; gap: 10px; }
#landing-root .testi-avatar { width: 42px; height: 42px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-family: 'Sora', sans-serif; font-size: 16px; flex-shrink: 0; }
#landing-root .testi-name { font-weight: 700; font-size: 14px; }
#landing-root .testi-role { font-size: 12.5px; color: var(--faint); }

/* pricing */
#landing-root .plans-row { display: flex; gap: 20px; flex-wrap: wrap; align-items: stretch; padding: 0 0 8px; }
#landing-root .plan-card { flex: 1; min-width: 260px; display: flex; flex-direction: column; text-align: center; position: relative; background: #fff; border: 1px solid var(--card-border); border-radius: 24px; padding: 32px; box-shadow: 0 18px 40px -26px rgba(46,42,84,0.2); }
#landing-root .plan-featured { background: var(--indigo); border: none; color: #fff; box-shadow: 0 26px 50px -18px rgba(46,42,84,0.45); transform: translateY(-8px); }
#landing-root .plan-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--green); color: #fff; font-size: 11.5px; font-weight: 700; padding: 5px 14px; border-radius: 999px; white-space: nowrap; }
#landing-root .plan-name { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 17px; color: var(--violet); }
#landing-root .plan-name-on-dark { color: #C9BEF0; }
#landing-root .plan-price { margin: 14px 0 4px; }
#landing-root .plan-amount { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 38px; }
#landing-root .plan-amount-on-dark { color: #fff; }
#landing-root .plan-period { color: var(--faint); font-size: 14px; }
#landing-root .plan-period-on-dark { color: #B9B2D8; }
#landing-root .plan-note { font-size: 12.5px; color: var(--faint); margin-bottom: 4px; }
#landing-root .plan-note-on-dark { color: #C9BEF0; }
#landing-root .plan-features { text-align: left; display: flex; flex-direction: column; gap: 10px; margin: 22px 0 24px; flex: 1; }
#landing-root .plan-feat { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; color: #3F3C4A; }
#landing-root .plan-feat-on-dark { color: #E4E1F2; }
#landing-root .plan-cta { justify-content: center; }
#landing-root .plan-cta-on-dark { background: #fff; color: var(--indigo); }
#landing-root .plan-cta-on-dark:hover { color: var(--indigo); transform: scale(1.03); }
#landing-root .plans-footnote { text-align: center; font-size: 12.5px; color: var(--faint); margin-top: 22px; }

/* faq */
#landing-root .faq-item { border-bottom: 1px solid rgba(46,42,84,0.1); padding: 18px 4px; }
#landing-root .faq-q { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-weight: 600; font-size: 15.5px; cursor: pointer; }
#landing-root .faq-chevron { display: inline-block; color: var(--violet); font-size: 18px; flex-shrink: 0; transition: transform .25s ease; }
#landing-root .faq-item[data-open="true"] .faq-chevron { transform: rotate(45deg); }
#landing-root .faq-a { max-height: 0; margin-top: 0; overflow: hidden; font-size: 14px; color: var(--muted); line-height: 1.6; transition: max-height .3s ease, margin-top .3s ease; }
#landing-root .faq-item[data-open="true"] .faq-a { margin-top: 10px; }

/* final CTA */
#landing-root .cta-glow { background: linear-gradient(150deg,var(--indigo),var(--violet)); border-radius: 26px; padding: 56px 40px; text-align: center; position: relative; overflow: hidden; box-shadow: 0 0 80px -10px rgba(110,86,207,0.6); }
#landing-root .cta-title { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 30px; color: #fff; margin-bottom: 10px; }
#landing-root .cta-sub { font-size: 15px; color: #E4E1F2; margin-bottom: 26px; }

/* legal pages */
#landing-root .legal-page { display: none; }
#landing-root .legal-back { font-size: 14px; color: var(--violet); display: inline-flex; align-items: center; gap: 6px; margin-bottom: 24px; }
#landing-root .legal-page h1 { font-weight: 800; font-size: 32px; margin: 0 0 4px; }
#landing-root .legal-date { font-size: 13px; color: var(--faint); margin-bottom: 32px; }
#landing-root .legal-page h2 { font-weight: 700; font-size: 18px; margin: 28px 0 8px; }
#landing-root .legal-page p { font-size: 14.5px; line-height: 1.7; color: #3F3C4A; margin: 0; }

/* footer */
#landing-root .site-footer { background: #15132A; color: #fff; }
#landing-root .footer-grid { display: flex; flex-wrap: wrap; gap: 32px; justify-content: space-between; padding: 52px 24px 32px; }
#landing-root .footer-brand { min-width: 200px; max-width: 280px; }
#landing-root .footer-logo { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 19px; margin-bottom: 10px; }
#landing-root .footer-tag { font-size: 13px; color: #9C97B5; line-height: 1.6; }
#landing-root .footer-col { min-width: 130px; display: flex; flex-direction: column; gap: 9px; }
#landing-root .footer-head { font-weight: 600; font-size: 12.5px; color: #9C97B5; margin-bottom: 5px; letter-spacing: .04em; }
#landing-root .footer-col a { color: #D6D2E3; font-size: 13.5px; }
#landing-root .footer-col a:hover { color: #fff; }
#landing-root .footer-store { display: flex; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 8px 12px; font-size: 12.5px; color: #D6D2E3; }
#landing-root .footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); text-align: center; padding: 18px 24px; font-size: 12px; color: #7D7896; }

@media (max-width: 900px) {
  #landing-root .nav-links { display: none; }
  #landing-root .nav-toggle { display: flex; }
  #landing-root .bento { grid-template-columns: repeat(2,1fr); grid-auto-rows: auto; }
  #landing-root .bento-big { grid-column: 1 / 3; grid-row: auto; }
  #landing-root .bento-wide { grid-column: 1 / 3; grid-row: auto; }
}
@media (max-width: 640px) {
  #landing-root .hero h1 { font-size: 38px; }
  #landing-root .hero-visual { display: none; }
  #landing-root .bento { grid-template-columns: 1fr; }
  #landing-root .bento-big, #landing-root .bento-wide { grid-column: 1; }
  #landing-root .plan-featured { transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  #landing-root .blob, #landing-root .float-card, #landing-root .pulse-ring, #landing-root .ai-particle, #landing-root .ai-cursor { animation: none !important; }
}
.landing-smooth-scroll { scroll-behavior: smooth; }
#landing-root #features-section, #landing-root #how-it-works, #landing-root #pricing-section, #landing-root #faq-section { scroll-margin-top: 80px; }
`;

const VIOLET = "#6E56CF";
const INDIGO = "#2E2A54";
const GREEN = "#22C55E";

const ICON_SHAPES: Record<string, string> = {
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.2"/><path d="M9 7l1.5-2h3L15 7"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M3 17l5-5 4 4 3-3 6 6"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14" r="1.4"/>',
  people: '<circle cx="9" cy="9" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="10" r="2.4"/><path d="M15.5 20c.3-2.6 2-4.6 4.5-5"/>',
  truck: '<rect x="2" y="9" width="12" height="8" rx="1.5"/><path d="M14 12h4l3 3v2h-7"/><circle cx="6" cy="19" r="1.8"/><circle cx="17" cy="19" r="1.8"/>',
  leaf: '<path d="M5 19c-1-6 2-13 14-14 1 10-6 15-14 14z"/><path d="M6 18c3-4 6-6 11-12"/>',
  chat: '<path d="M4 5h16v10H9l-5 4v-4H4z"/>',
  stetho: '<path d="M6 3v6a4 4 0 008 0V3"/><path d="M10 13v2a5 5 0 0010 0v-2"/><circle cx="20" cy="13" r="1.6"/>',
  store: '<path d="M4 9l1-5h14l1 5"/><rect x="4" y="9" width="16" height="11" rx="1"/><line x1="9" y1="20" x2="9" y2="14"/>',
  sprout: '<path d="M12 21V10"/><path d="M12 10c0-4-3-6-7-6 0 4 3 6 7 6z"/><path d="M12 14c0-3 2.5-5 6-5 0 3-2.5 5-6 5z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 10-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2 2-2-2z"/>',
  cloud: '<path d="M6 18a4 4 0 010-8 5 5 0 019.6-1.5A4.5 4.5 0 0118 18H6z"/>',
  basket: '<path d="M4 10h16l-2 10H6L4 10z"/><path d="M8 10l2-6h4l2 6"/><line x1="9" y1="14" x2="9.5" y2="17"/><line x1="15" y1="14" x2="14.5" y2="17"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><line x1="10" y1="19" x2="14" y2="19"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4V8z"/>',
};

function svgIcon(name: keyof typeof ICON_SHAPES, color: string, size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_SHAPES[name]}</svg>`;
}

const ICONS: Record<string, string> = {
  ICON_CAMERA: svgIcon("camera", VIOLET, 22),
  ICON_WALLET: svgIcon("wallet", VIOLET, 22),
  ICON_STETHO: svgIcon("stetho", VIOLET, 22),
  ICON_STORE: svgIcon("store", GREEN, 22),
  ICON_CLOUD: svgIcon("cloud", VIOLET, 22),
  ICON_BASKET: svgIcon("basket", GREEN, 22),
  ICON_LEAF_WHITE: svgIcon("leaf", "#fff", 34),
  ICON_PHOTO: svgIcon("photo", VIOLET, 26),
  ICON_STORE_G: svgIcon("store", GREEN, 30),
  ICON_TRUCK: svgIcon("truck", VIOLET, 26),
  ICON_PEOPLE: svgIcon("people", VIOLET, 26),
  ICON_CHAT: svgIcon("chat", VIOLET, 26),
  ICON_SPROUT_WHITE: svgIcon("sprout", "#fff", 22),
  ICON_PEOPLE_WHITE: svgIcon("people", "#fff", 22),
  ICON_CAMERA_WHITE: svgIcon("camera", "#fff", 22),
  ICON_WALLET_WHITE: svgIcon("wallet", "#fff", 22),
  ICON_PLAY: svgIcon("play", INDIGO, 24),
  ICON_STORE_WHITE: svgIcon("store", "#fff", 26),
  ICON_WRENCH_WHITE: svgIcon("wrench", "#fff", 26),
  ICON_LEAF_TINY: svgIcon("leaf", "#fff", 15),
  ICON_CHAT_TINY: svgIcon("chat", "#fff", 15),
  ICON_STETHO_TINY: svgIcon("stetho", "#fff", 15),
  ICON_CHECK: svgIcon("check", GREEN, 18),
  ICON_CHECK_LIGHT: svgIcon("check", "#B9F5CE", 18),
  ICON_PHONE_TINY: svgIcon("phone", "#D6D2E3", 15),
};

const RENDERED_HTML = LANDING_HTML.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => ICONS[name] ?? "");

const AI_PROMPTS = [
  "My tomato leaves have brown spots, what should I spray?",
  "How much did I earn from coffee this month?",
  "Find a tractor for rent near Chikkamagaluru",
];

interface LandingProps {
  onNavigate: (target: "login" | "signup") => void;
}

export default function Landing({ onNavigate }: LandingProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    document.documentElement.classList.add("landing-smooth-scroll");
    const cleanups: Array<() => void> = [() => document.documentElement.classList.remove("landing-smooth-scroll")];

    function showPage(page: "landing" | "terms" | "privacy") {
      const landing = root!.querySelector<HTMLElement>("#page-landing");
      const terms = root!.querySelector<HTMLElement>("#page-terms");
      const privacy = root!.querySelector<HTMLElement>("#page-privacy");
      if (landing) landing.style.display = page === "landing" ? "" : "none";
      if (terms) terms.style.display = page === "terms" ? "block" : "none";
      if (privacy) privacy.style.display = page === "privacy" ? "block" : "none";
      window.scrollTo({ top: 0 });
    }

    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest(
        "[data-nav], [data-open-mobile-nav], [data-close-mobile-nav], [data-faq-toggle], [data-page]",
      ) as HTMLElement | null;
      if (!target) return;

      const navTarget = target.getAttribute("data-nav");
      if (navTarget === "login" || navTarget === "signup") {
        e.preventDefault();
        onNavigate(navTarget);
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
      if (target.matches("[data-page]")) {
        e.preventDefault();
        showPage(target.getAttribute("data-page") as "landing" | "terms" | "privacy");
        root!.querySelector("#mobileSheet")?.classList.remove("open");
        return;
      }
      if (target.matches("[data-faq-toggle]")) {
        const item = target.closest(".faq-item");
        if (!item) return;
        const isOpen = item.getAttribute("data-open") === "true";
        root!.querySelectorAll(".faq-item").forEach((el) => el.setAttribute("data-open", "false"));
        if (!isOpen) item.setAttribute("data-open", "true");
      }
    }
    root.addEventListener("click", handleClick);
    cleanups.push(() => root.removeEventListener("click", handleClick));

    // --- Scroll progress bar ---
    const progressBar = root.querySelector<HTMLElement>("#progressBar");
    let ticking = false;
    function updateProgress() {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? Math.min(100, (window.scrollY / docH) * 100) : 0;
      if (progressBar) progressBar.style.width = `${pct}%`;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateProgress();
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateProgress();
    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    });

    // --- Scroll-reveal ---
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let statsAnimated = false;
    function animateStats(section: HTMLElement) {
      if (statsAnimated) return;
      statsAnimated = true;
      const nums = section.querySelectorAll<HTMLElement>("[data-count]");
      const start = performance.now();
      const dur = 1300;
      function step(t: number) {
        const p = Math.min(1, (t - start) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        nums.forEach((el) => {
          const target = Number(el.getAttribute("data-count"));
          const decimals = Number(el.getAttribute("data-decimal") ?? 0);
          const suffix = el.getAttribute("data-suffix") ?? "";
          const value = target * ease;
          el.textContent = (decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString()) + suffix;
        });
        if (p < 1) requestAnimationFrame(step);
      }
      if (reduceMotion) {
        nums.forEach((el) => {
          const target = Number(el.getAttribute("data-count"));
          const decimals = Number(el.getAttribute("data-decimal") ?? 0);
          const suffix = el.getAttribute("data-suffix") ?? "";
          el.textContent = (decimals > 0 ? target.toFixed(decimals) : target.toLocaleString()) + suffix;
        });
      } else {
        requestAnimationFrame(step);
      }
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.classList.add("revealed");
          if (el.querySelector("[data-count]")) animateStats(el);
          revealObserver.unobserve(el);
        });
      },
      { threshold: 0.15 },
    );
    root.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));
    if (reduceMotion) root.querySelectorAll(".reveal").forEach((el) => el.classList.add("revealed"));
    cleanups.push(() => revealObserver.disconnect());

    // --- Hero parallax (phone + floating cards) ---
    const heroVisual = root.querySelector<HTMLElement>("#heroVisual");
    const phone = root.querySelector<HTMLElement>("#phone");
    const floatCards = root.querySelectorAll<HTMLElement>("[data-float]");
    const floatMultipliers = [14, 18, 12, 16, 10, 15];
    if (heroVisual && !reduceMotion) {
      function onHeroMove(e: MouseEvent) {
        const rect = heroVisual!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        if (phone) phone.style.transform = `translate(${x * 8}px, ${y * 8}px)`;
        floatCards.forEach((card, i) => {
          const m = floatMultipliers[i % floatMultipliers.length];
          card.style.transform = `translate(${x * m}px, ${y * m}px)`;
        });
      }
      function onHeroLeave() {
        if (phone) phone.style.transform = "";
        floatCards.forEach((card) => (card.style.transform = ""));
      }
      heroVisual.addEventListener("mousemove", onHeroMove);
      heroVisual.addEventListener("mouseleave", onHeroLeave);
      cleanups.push(() => {
        heroVisual.removeEventListener("mousemove", onHeroMove);
        heroVisual.removeEventListener("mouseleave", onHeroLeave);
      });
    }

    // --- Magnetic hero CTA ---
    const magnetBtn = root.querySelector<HTMLElement>("#magnetBtn");
    if (magnetBtn && !reduceMotion) {
      function onMagnetMove(e: MouseEvent) {
        const rect = magnetBtn!.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.25;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.25;
        magnetBtn!.style.transform = `translate(${x}px, ${y}px)`;
      }
      function onMagnetLeave() {
        magnetBtn!.style.transform = "";
      }
      magnetBtn.addEventListener("mousemove", onMagnetMove);
      magnetBtn.addEventListener("mouseleave", onMagnetLeave);
      cleanups.push(() => {
        magnetBtn.removeEventListener("mousemove", onMagnetMove);
        magnetBtn.removeEventListener("mouseleave", onMagnetLeave);
      });
    }

    // --- AI prompt typewriter ---
    const aiTypedText = root.querySelector<HTMLElement>("#aiTypedText");
    if (aiTypedText) {
      if (reduceMotion) {
        aiTypedText.textContent = AI_PROMPTS[0];
      } else {
        let promptIndex = 0;
        let charIndex = 0;
        let phase: "typing" | "pause" | "deleting" = "typing";
        let pauseUntil = 0;
        const timer = setInterval(() => {
          const full = AI_PROMPTS[promptIndex];
          if (phase === "typing") {
            if (charIndex < full.length) charIndex++;
            else {
              phase = "pause";
              pauseUntil = Date.now() + 1500;
            }
          } else if (phase === "pause") {
            if (Date.now() > pauseUntil) phase = "deleting";
          } else {
            if (charIndex > 0) charIndex--;
            else {
              phase = "typing";
              promptIndex = (promptIndex + 1) % AI_PROMPTS.length;
            }
          }
          aiTypedText.textContent = full.slice(0, charIndex);
        }, 45);
        cleanups.push(() => clearInterval(timer));
      }
    }

    return () => cleanups.forEach((fn) => fn());
  }, [onNavigate]);

  return (
    <div id="landing-root" ref={rootRef}>
      <style>{LANDING_CSS}</style>
      <div dangerouslySetInnerHTML={{ __html: RENDERED_HTML }} />
    </div>
  );
}
