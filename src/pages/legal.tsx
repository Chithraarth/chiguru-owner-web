import { useState } from "react";
import { Link, useLocation } from "wouter";

// Real, deep-linkable /terms and /privacy pages (split out of landing.tsx,
// which used to show this content via in-page div toggling). Header and
// footer mirror landing.tsx's markup/theme (violet/indigo, same fonts) so a
// visitor landing here directly (e.g. from an app store listing) still sees
// Chiguru's own chrome, not a bare content page.
const LEGAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

#legal-root {
  --violet: #6E56CF;
  --indigo: #2E2A54;
  --ink: #1A1830;
  --ink-soft: #4A4660;
  --faint: #8A8794;
  --bg: #FAFAFC;
  font-family: 'IBM Plex Sans', sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
}
#legal-root * { box-sizing: border-box; }
#legal-root a { color: var(--violet); text-decoration: none; }
#legal-root a:hover { color: var(--indigo); text-decoration: underline; }
#legal-root .wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }

/* header, copied from landing.tsx's .nav */
#legal-root .nav { position: sticky; top: 0; z-index: 50; background: rgba(250,250,252,0.75); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(46,42,84,0.08); }
#legal-root .nav-row { padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
#legal-root .brand { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 20px; color: var(--ink); cursor: pointer; }
#legal-root .brand:hover { text-decoration: none; color: var(--ink); }
#legal-root .nav-cta { display: flex; align-items: center; gap: 16px; }
#legal-root .nav-toggle { display: none; background: none; border: none; color: var(--ink); cursor: pointer; padding: 6px; }
#legal-root .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; border-radius: 28px; padding: 10px 18px; cursor: pointer; }
#legal-root .btn:hover { text-decoration: none; }
#legal-root .btn-primary { background: var(--indigo); color: #fff; }
#legal-root .btn-primary:hover { background: #1F1C3D; color: #fff; }
#legal-root .btn-ghost { background: #fff; border: 1px solid rgba(46,42,84,0.15); color: var(--ink); }
#legal-root .btn-ghost:hover { color: var(--ink); }

#legal-root .mobile-sheet { position: fixed; inset: 0 0 0 auto; width: min(320px, 84vw); background: #fff; z-index: 60; transform: translateX(100%); transition: transform .25s ease; display: flex; flex-direction: column; padding: 20px; box-shadow: -20px 0 50px -20px rgba(26,24,48,0.3); }
#legal-root .mobile-sheet.open { transform: translateX(0); }
#legal-root .mobile-sheet-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
#legal-root .mobile-sheet-ctas { display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 640px) {
  #legal-root .nav-cta > a.btn { display: none; }
  #legal-root .nav-toggle { display: flex; }
}

/* hero banner */
#legal-root .legal-hero { background: var(--indigo); padding: 64px 24px; text-align: center; }
#legal-root .legal-hero h1 { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 40px; color: #fff; margin: 0; }

/* legal content */
#legal-root .wrap-legal { max-width: 700px; margin: 0 auto; padding: 48px 24px 64px; }
#legal-root .legal-date { font-size: 13px; color: var(--faint); margin-bottom: 32px; }
#legal-root h2 { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 18px; margin: 28px 0 8px; color: var(--ink); }
#legal-root p { font-size: 14.5px; line-height: 1.7; color: #3F3C4A; margin: 0; }

/* footer, copied from landing.tsx's .site-footer */
#legal-root .site-footer { background: #15132A; color: #fff; margin-top: 40px; }
#legal-root .footer-grid { display: flex; flex-wrap: wrap; gap: 32px; justify-content: space-between; padding: 52px 24px 32px; }
#legal-root .footer-brand { min-width: 200px; max-width: 280px; }
#legal-root .footer-logo { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 19px; margin-bottom: 10px; }
#legal-root .footer-tag { font-size: 13px; color: #9C97B5; line-height: 1.6; }
#legal-root .footer-col { min-width: 130px; display: flex; flex-direction: column; gap: 9px; }
#legal-root .footer-head { font-weight: 600; font-size: 12.5px; color: #9C97B5; margin-bottom: 5px; letter-spacing: .04em; }
#legal-root .footer-col a { color: #D6D2E3; font-size: 13.5px; }
#legal-root .footer-col a:hover { color: #fff; }
#legal-root .footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); text-align: center; padding: 18px 24px; font-size: 12px; color: #7D7896; }
`;

function LegalHeader() {
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-row">
          <Link href="/" className="brand">Chiguru</Link>
          <div className="nav-cta">
            <a className="btn btn-ghost" href="/login">Sign In</a>
            <a className="btn btn-primary" href="/signup">Sign Up</a>
            <button
              className="nav-toggle"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
          </div>
        </div>
      </nav>

      <div className={`mobile-sheet${menuOpen ? " open" : ""}`}>
        <div className="mobile-sheet-head">
          <span className="brand" style={{ fontSize: "1.1rem" }}>Chiguru</span>
          <button className="nav-toggle" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div className="mobile-sheet-ctas">
          <a className="btn btn-primary" href="/signup" onClick={() => navigate("/signup")}>Sign Up</a>
          <a className="btn btn-ghost" href="/login" onClick={() => navigate("/login")}>Sign In</a>
        </div>
      </div>
    </>
  );
}

function LegalFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <div className="footer-logo">Chiguru</div>
          <div className="footer-tag">One app to run your whole farm.</div>
        </div>
        <div className="footer-col">
          <div className="footer-head">PRODUCT</div>
          <a href="/signup">Open app</a>
        </div>
        <div className="footer-col">
          <div className="footer-head">LEGAL</div>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </div>
      </div>
      <div className="footer-bottom">© 2026 Chiguru. Made for farmers.</div>
    </footer>
  );
}

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div id="legal-root">
      <style>{LEGAL_CSS}</style>
      <LegalHeader />
      <div className="legal-hero">
        <h1>{title}</h1>
      </div>
      <div className="wrap-legal">
        {children}
      </div>
      <LegalFooter />
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p className="legal-date">Effective Date: August 6, 2026</p>

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
      <p>Our <Link href="/privacy">Privacy Policy</Link> explains what information we collect, including face photos used for attendance, and how we use and protect it.</p>

      <h2>8. Termination</h2>
      <p>You may stop using Chiguru and cancel your subscription at any time. We may suspend or close accounts that violate these terms or misuse the app.</p>

      <h2>9. Limitation of Liability</h2>
      <p>Chiguru is provided as a farm management tool. To the extent permitted by law, we are not liable for losses arising from crop outcomes, missed reminders, third-party transactions, or connectivity issues in the field.</p>

      <h2>10. Changes to These Terms</h2>
      <p>We may update these terms from time to time. We will let you know about significant changes in the app before they take effect.</p>

      <h2>11. Contact</h2>
      <p>Questions about these terms? Contact us at <a href="mailto:support@thechiguru.com">support@thechiguru.com</a>.</p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p className="legal-date">Effective Date: August 6, 2026</p>

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
      <p>Questions about your data? Contact us at <a href="mailto:support@thechiguru.com">support@thechiguru.com</a>.</p>
    </LegalLayout>
  );
}
