import React, { useEffect, useRef } from 'react';

/**
 * Reusable Google AdSense component
 * Usage:
 *  <AdSense slot="YOUR_SLOT_ID" format="auto" responsive="true" style={{ display: 'block' }} />
 * Env vars:
 *  - VITE_ENABLE_ADS=true to enable
 *  - VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
 */
export default function AdSense({ slot, format = 'auto', responsive = 'true', style = { display: 'block' }, className = '' }) {
  const containerRef = useRef(null);

  const enabled = import.meta.env.VITE_ENABLE_ADS === 'true' || import.meta.env.VITE_ENABLE_ADS === true;
  const client = import.meta.env.VITE_ADSENSE_CLIENT;

  useEffect(() => {
    if (!enabled || !client || !slot) return;
    if (typeof window === 'undefined') return;

    // Load AdSense script once
    const scriptId = 'adsbygoogle-js';
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script');
      s.id = scriptId;
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      s.crossOrigin = 'anonymous';
      document.head.appendChild(s);
    }

    const tryPush = () => {
      if (!window.adsbygoogle) {
        window.adsbygoogle = [];
      }
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // Fail silently
      }
    };

    // Defer push slightly to ensure script readiness
    const t = setTimeout(tryPush, 300);
    return () => clearTimeout(t);
  }, [enabled, client, slot]);

  if (!enabled || !client || !slot) {
    return null;
  }

  return (
    <div ref={containerRef} className={className}>
      <ins
        className="adsbygoogle"
        style={style}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
}
