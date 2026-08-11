import { Link } from "wouter";

// Real, deep-linkable /terms and /privacy pages (split out of landing.tsx,
// which used to show this content via in-page div toggling). Styling is
// self-contained, matching the landing page's legal-page look, since these
// pages are reachable directly (e.g. from an app store listing) without the
// rest of the landing page's chrome.
const LEGAL_CSS = `
#legal-page {
  --violet: #6E56CF;
  --indigo: #2E2A54;
  --ink: #1A1830;
  --faint: #8A8794;
  --bg: #FAFAFC;
  font-family: 'IBM Plex Sans', sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
}
#legal-page a { color: var(--violet); text-decoration: none; }
#legal-page a:hover { color: var(--indigo); text-decoration: underline; }
#legal-page .wrap-legal { max-width: 700px; margin: 0 auto; padding: 48px 24px 64px; }
#legal-page .legal-back { font-size: 14px; color: var(--violet); display: inline-flex; align-items: center; gap: 6px; margin-bottom: 24px; }
#legal-page h1 { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 32px; margin: 0 0 4px; color: var(--ink); }
#legal-page .legal-date { font-size: 13px; color: var(--faint); margin-bottom: 32px; }
#legal-page h2 { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 18px; margin: 28px 0 8px; color: var(--ink); }
#legal-page p { font-size: 14.5px; line-height: 1.7; color: #3F3C4A; margin: 0; }
`;

function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="legal-page">
      <style>{LEGAL_CSS}</style>
      <div className="wrap-legal">
        <Link href="/" className="legal-back">← Back to Chiguru</Link>
        {children}
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalLayout>
      <h1>Terms of Service</h1>
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
    <LegalLayout>
      <h1>Privacy Policy</h1>
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
