import { useEffect } from 'react';

/**
 * SEO Component for managing page metadata
 * Updates document title, meta tags, and structured data
 * 
 * @param {Object} props
 * @param {string} props.title - Page title (will be appended to site name)
 * @param {string} props.description - Page description
 * @param {string} props.keywords - Comma-separated keywords
 * @param {string} props.image - Open Graph image URL
 * @param {string} props.url - Canonical URL
 * @param {string} props.type - Open Graph type (website, article, etc.)
 * @param {Object} props.structuredData - JSON-LD structured data object
 */
const SEO = ({
  title = 'Wildcat Radio | Live Campus Radio',
  description = 'Wildcat Radio - Official live campus radio of Cebu Institute of Technology University (CITU). Stream live broadcasts, join the community chat, and explore schedules.',
  keywords = 'wildcat radio, wildcats radio, CIT radio, CITU radio, Cebu Institute of Technology radio, CIT University radio, campus radio, live radio streaming, online radio, school radio, student radio, broadcast, radio station, live music, campus broadcasting, wildcat radio live, CITU campus radio, Cebu radio station, Philippines campus radio, educational radio',
  image = '/wildcat_logo.png',
  url = '',
  type = 'website',
  structuredData = null
}) => {
  const siteName = 'Wildcat Radio';
  
  // Get site URL from env var, or fallback to current origin, or placeholder
  const getSiteUrl = () => {
    if (import.meta.env.VITE_SITE_URL) {
      return import.meta.env.VITE_SITE_URL;
    }
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin;
      // Only use origin if it's not localhost (production check)
      if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return origin;
      }
    }
    return 'https://wildcats-radio.live';
  };
  
  const siteUrl = getSiteUrl();
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  const fullUrl = url ? `${siteUrl}${url}` : siteUrl;
  const fullImageUrl = image.startsWith('http') ? image : `${siteUrl}${image}`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper function to update or create meta tag
    const updateMetaTag = (name, content, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`);
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      
      meta.setAttribute('content', content);
    };

    // Update basic meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('robots', 'index, follow');
    
    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', fullUrl);

    // Open Graph tags
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', siteName, true);
    updateMetaTag('og:title', fullTitle, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:url', fullUrl, true);
    updateMetaTag('og:image', fullImageUrl, true);
    updateMetaTag('og:image:alt', `${siteName} - ${title}`, true);
    updateMetaTag('og:image:width', '1200', true);
    updateMetaTag('og:image:height', '630', true);

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', fullImageUrl);
    updateMetaTag('twitter:image:alt', `${siteName} - ${title}`);

    // Update or create structured data (JSON-LD)
    let structuredDataScript = document.querySelector('script[type="application/ld+json"]');
    if (structuredData) {
      if (!structuredDataScript) {
        structuredDataScript = document.createElement('script');
        structuredDataScript.setAttribute('type', 'application/ld+json');
        document.head.appendChild(structuredDataScript);
      }
      structuredDataScript.textContent = JSON.stringify(structuredData);
    } else if (structuredDataScript) {
      // Remove if no structured data provided
      structuredDataScript.remove();
    }

    // Cleanup function (optional, but good practice)
    return () => {
      // Note: We don't revert changes on unmount to maintain SEO even during navigation
      // The component will update tags when mounted on a new page
    };
  }, [title, description, keywords, image, url, type, structuredData, fullTitle, fullUrl, fullImageUrl]);

  return null; // This component doesn't render anything
};

export default SEO;

