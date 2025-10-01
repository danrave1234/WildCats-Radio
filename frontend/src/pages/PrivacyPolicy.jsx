import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="prose prose-invert max-w-3xl">
      <h1 className="text-2xl font-bold text-yellow-400 mb-4">Privacy Policy</h1>
      <p className="text-white/80 mb-4">
        This policy explains what information WildCats Radio collects, how we use and share it,
        and the choices you have. We aim to collect only what we need to deliver a reliable,
        secure, and enjoyable listening and broadcasting experience.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">Information We Collect</h2>
      <ul className="list-disc pl-6 text-white/80">
        <li>
          <span className="font-semibold">Account Information</span> (if you register): name, email address,
          role (e.g., listener, DJ, moderator, admin), and profile preferences you provide.
        </li>
        <li>
          <span className="font-semibold">Usage Data</span>: interactions with the app (pages viewed, features used),
          timestamps, approximate region/country derived from IP, and device/browser type.
        </li>
        <li>
          <span className="font-semibold">Streaming & Broadcast Data</span>: active broadcast metadata (title, DJ/host,
          description), listener counts, and current track metadata submitted by DJs or fetched
          from integrated services.
        </li>
        <li>
          <span className="font-semibold">Technical Logs</span>: diagnostic logs and error reports to keep services
          reliable and secure.
        </li>
        <li>
          <span className="font-semibold">Cookies & Local Storage</span>: used for session management, theme
          preferences, and performance.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">How We Use Information</h2>
      <ul className="list-disc pl-6 text-white/80">
        <li>Operate core features like streaming, schedules, notifications, and moderation.</li>
        <li>Maintain security, fraud prevention, and service integrity.</li>
        <li>Understand service performance and improve reliability and usability.</li>
        <li>Comply with legal obligations and institutional policies.</li>
      </ul>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">Cookies and Similar Technologies</h2>
      <p className="text-white/80">
        We use strictly necessary cookies for authentication (when logged in), CSRF protection,
        and user preferences (e.g., dark mode). Analytics cookies may be used to measure traffic
        and usage. You can control cookies via your browser settings; disabling some may limit
        functionality.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">Analytics</h2>
      <p className="text-white/80">
        We may collect aggregate metrics such as visitor counts, popular pages, and playback
        stability to improve the experience. Analytics are used in de-identified or aggregated
        form whenever feasible.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">When We Share Information</h2>
      <ul className="list-disc pl-6 text-white/80">
        <li>Service providers that help us operate the platform (hosting, storage, monitoring).</li>
        <li>School or institutional administrators for compliance and safety purposes.</li>
        <li>Legal or safety requirements (e.g., court orders, preventing harm or abuse).</li>
        <li>With your consent or at your direction.</li>
      </ul>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">Your Choices & Rights</h2>
      <ul className="list-disc pl-6 text-white/80">
        <li>Access, update, or delete your account information from your profile when logged in.</li>
        <li>Request a copy or deletion of your data (subject to legal and operational limits).</li>
        <li>Opt out of non-essential communications where applicable.</li>
      </ul>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">Data Retention</h2>
      <p className="text-white/80">
        We retain personal information only as long as necessary for the purposes described
        above, to comply with legal obligations, resolve disputes, and enforce agreements.
        Broadcast metadata and aggregate analytics may be retained for historical and
        reporting purposes.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">Security</h2>
      <p className="text-white/80">
        We use reasonable administrative, technical, and organizational safeguards to protect
        information. No method of transmission or storage is 100% secure, but we continuously
        improve protections.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">Children's Privacy</h2>
      <p className="text-white/80">
        Our services are intended for general audiences. If we learn we have collected
        personal information from a child without appropriate consent, we will take steps to
        delete it.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">Changes to This Policy</h2>
      <p className="text-white/80">
        We may update this policy to reflect improvements or legal changes. We will post
        updates here and revise the “Last updated” date below.
      </p>

      <p className="text-white/60 mt-6">Last updated: {new Date().toLocaleDateString()}</p>
      <p className="text-white/70 mt-2">
        Questions? Visit our <a href="/contact" className="text-yellow-300 hover:underline">Contact</a> page.
      </p>
    </div>
  );
}


