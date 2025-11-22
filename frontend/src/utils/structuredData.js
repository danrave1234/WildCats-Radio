/**
 * Structured Data (JSON-LD) utilities for SEO
 * Generates schema.org markup for better search engine understanding
 */

/**
 * Generate Organization structured data
 */
export const generateOrganizationData = (siteUrl = 'https://wildcats-radio.live') => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  'name': 'Wildcat Radio',
  'alternateName': ['CIT Radio', 'CITU Radio', 'CIT University Radio', 'Wildcats Radio Live'],
  'url': siteUrl,
  'logo': `${siteUrl}/wildcat_logo.png`,
  'description': 'Official live campus radio of Cebu Institute of Technology University (CITU) - Wildcat Radio streams live campus broadcasts, music, and community content',
  'foundingDate': '2024',
  'parentOrganization': {
    '@type': 'EducationalOrganization',
    'name': 'Cebu Institute of Technology University',
    'alternateName': ['CITU', 'CIT'],
    'address': {
      '@type': 'PostalAddress',
      'addressLocality': 'Cebu',
      'addressCountry': 'PH'
    }
  },
  'sameAs': [
    // Add social media links if available
    // 'https://facebook.com/wildcatradio',
    // 'https://twitter.com/wildcatradio',
  ]
});

/**
 * Generate WebSite structured data
 */
export const generateWebSiteData = (siteUrl = 'https://wildcats-radio.live') => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  'name': 'Wildcat Radio',
  'alternateName': ['CIT Radio', 'CITU Radio', 'CIT University Radio', 'Wildcats Radio Live'],
  'url': siteUrl,
  'description': 'Official live campus radio streaming platform of Cebu Institute of Technology University (CITU)',
  'potentialAction': {
    '@type': 'SearchAction',
    'target': {
      '@type': 'EntryPoint',
      'urlTemplate': `${siteUrl}/search?q={search_term_string}`
    },
    'query-input': 'required name=search_term_string'
  }
});

/**
 * Generate BroadcastEvent structured data
 */
export const generateBroadcastEventData = (broadcast, siteUrl = 'https://wildcats-radio.live') => {
  if (!broadcast) return null;

  const startDate = broadcast.startTime ? new Date(broadcast.startTime).toISOString() : null;
  const endDate = broadcast.endTime ? new Date(broadcast.endTime).toISOString() : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BroadcastEvent',
    'name': broadcast.title || 'Live Broadcast',
    'description': broadcast.description || 'Live radio broadcast on Wildcat Radio',
    'startDate': startDate,
    'endDate': endDate,
    'eventStatus': broadcast.isLive 
      ? 'https://schema.org/EventScheduled' 
      : 'https://schema.org/EventPostponed',
    'organizer': {
      '@type': 'Organization',
      'name': 'Wildcat Radio'
    },
    'location': {
      '@type': 'OnlineRadioStation',
      'name': 'Wildcat Radio',
      'url': siteUrl
    }
  };
};

/**
 * Generate RadioStation structured data
 */
export const generateRadioStationData = (siteUrl = 'https://wildcats-radio.live') => ({
  '@context': 'https://schema.org',
  '@type': 'RadioStation',
  'name': 'Wildcat Radio',
  'alternateName': ['CIT Radio', 'CITU Radio', 'CIT University Radio', 'Wildcats Radio Live'],
  'url': siteUrl,
  'description': 'Official live campus radio station of Cebu Institute of Technology University (CITU) streaming online',
  'broadcastFrequency': 'Online',
  'broadcastTimezone': 'Asia/Manila',
  'parentOrganization': {
    '@type': 'EducationalOrganization',
    'name': 'Cebu Institute of Technology University',
    'alternateName': ['CITU', 'CIT']
  }
});

/**
 * Generate BreadcrumbList structured data
 */
export const generateBreadcrumbData = (items, siteUrl = 'https://wildcats-radio.live') => {
  if (!items || items.length === 0) return null;

  const breadcrumbItems = items.map((item, index) => ({
    '@type': 'ListItem',
    'position': index + 1,
    'name': item.name,
    'item': item.url ? `${siteUrl}${item.url}` : undefined
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': breadcrumbItems
  };
};

/**
 * Generate Article structured data (for announcements, blog posts, etc.)
 */
export const generateArticleData = (article, siteUrl = 'https://wildcats-radio.live') => {
  if (!article) return null;

  const publishedDate = article.publishedAt ? new Date(article.publishedAt).toISOString() : null;
  const modifiedDate = article.updatedAt ? new Date(article.updatedAt).toISOString() : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': article.title,
    'description': article.content?.substring(0, 200) || article.description,
    'datePublished': publishedDate,
    'dateModified': modifiedDate,
    'author': {
      '@type': 'Person',
      'name': article.author || 'Wildcat Radio'
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Wildcat Radio',
      'logo': {
        '@type': 'ImageObject',
        'url': `${siteUrl}/wildcat_logo.png`
      }
    }
  };
};

