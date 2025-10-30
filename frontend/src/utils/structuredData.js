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
  'url': siteUrl,
  'logo': `${siteUrl}/wildcat_logo.png`,
  'description': 'Live campus radio streaming platform for school community',
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
  'url': siteUrl,
  'description': 'Live campus radio streaming platform',
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
  'url': siteUrl,
  'description': 'Live campus radio station streaming online',
  'broadcastFrequency': 'Online',
  'broadcastTimezone': 'America/Los_Angeles' // Update with actual timezone
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

