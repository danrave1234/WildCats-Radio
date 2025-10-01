import React from 'react';

export default function TermsOfService() {
  return (
    <div className="prose prose-invert max-w-3xl">
      <h1 className="text-2xl font-bold text-yellow-400 mb-4">Terms of Service</h1>
      <p className="text-white/80 mb-4">
        Welcome to WildCats Radio. By accessing or using our services, you agree to these Terms.
        If you do not agree, do not use the services.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">1. Eligibility & Accounts</h2>
      <ul className="list-disc pl-6 text-white/80">
        <li>You may listen publicly without an account. Certain features require registration.</li>
        <li>Provide accurate information and keep your credentials secure.</li>
        <li>Account roles (Listener, DJ, Moderator, Admin) determine available features.</li>
      </ul>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">2. Acceptable Use</h2>
      <ul className="list-disc pl-6 text-white/80">
        <li>Follow laws, school policies, and community guidelines.</li>
        <li>No harassment, hate speech, or unlawful content.</li>
        <li>No attempts to disrupt, reverse engineer, or scrape at scale.</li>
        <li>No unauthorized access to accounts, data, or systems.</li>
      </ul>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">3. User Content & Broadcasts</h2>
      <ul className="list-disc pl-6 text-white/80">
        <li>You are responsible for content you submit, broadcast, or upload.</li>
        <li>Do not share content you do not have rights to (e.g., copyrighted material) unless permitted.</li>
        <li>We may remove or restrict content that violates these Terms or law.</li>
        <li>Broadcast metadata (titles, descriptions, schedules) may be shown publicly.</li>
      </ul>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">4. Intellectual Property</h2>
      <ul className="list-disc pl-6 text-white/80">
        <li>The service, software, and design are owned by their respective rights holders.</li>
        <li>Trademarks and logos may not be used without permission.</li>
        <li>You retain ownership of your content. You grant us a license to host and display it as needed to operate the service.</li>
      </ul>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">5. Moderation & Enforcement</h2>
      <ul className="list-disc pl-6 text-white/80">
        <li>We may monitor, moderate, or remove content for safety and compliance.</li>
        <li>We may suspend or terminate accounts for violations or security concerns.</li>
      </ul>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">6. Third-Party Services</h2>
      <p className="text-white/80">
        The service may integrate with third-party platforms (e.g., streaming infrastructure, analytics).
        Your use of third-party services is subject to their terms and privacy policies.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">7. Disclaimers</h2>
      <p className="text-white/80">
        The services are provided “as is” and “as available” without warranties of any kind, to the
        fullest extent permitted by law. We do not guarantee uninterrupted or error-free operation.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">8. Limitation of Liability</h2>
      <p className="text-white/80">
        To the maximum extent permitted by law, WildCats Radio and its operators are not liable for
        indirect, incidental, special, consequential, or punitive damages, or loss of data or profits.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">9. Indemnification</h2>
      <p className="text-white/80">
        You agree to indemnify and hold harmless WildCats Radio, its operators, and affiliates from
        claims arising from your use of the services or your content, except to the extent caused by
        our own negligence or misconduct.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">10. Termination</h2>
      <p className="text-white/80">
        We may suspend or terminate access at any time for violations, security, or operational needs.
        You may stop using the services at any time.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">11. Governing Law</h2>
      <p className="text-white/80">
        These Terms are governed by applicable laws and institutional policies of the operating entity.
      </p>

      <h2 className="text-xl font-semibold text-yellow-300 mt-6 mb-2">12. Changes to These Terms</h2>
      <p className="text-white/80">
        We may update these Terms from time to time. Material changes will be posted here with an
        updated date. Continued use indicates acceptance of the changes.
      </p>

      <p className="text-white/60 mt-6">Last updated: {new Date().toLocaleDateString()}</p>
      <p className="text-white/70 mt-2">
        Questions? Visit our <a href="/contact" className="text-yellow-300 hover:underline">Contact</a> page.
      </p>
    </div>
  );
}


