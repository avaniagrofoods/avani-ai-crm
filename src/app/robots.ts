import type { MetadataRoute } from 'next';
import { OFFICIAL_BUSINESS } from '@/config/public-website';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/services',
          '/services/',
          '/blog',
          '/blog/',
          '/contact',
          '/enquiry',
          '/privacy',
          '/terms',
          '/disclaimer'
        ],
        disallow: [
          '/login',
          '/crm',
          '/leads',
          '/contacts',
          '/inbox',
          '/broadcasts',
          '/campaigns',
          '/schedule',
          '/templates',
          '/forms',
          '/conversational-components',
          '/tags',
          '/columns',
          '/opts',
          '/webhooks',
          '/gallery',
          '/faq',
          '/assistant',
          '/flows',
          '/projects',
          '/tasks',
          '/settings',
          '/knowledge',
          '/developers',
          '/guide',
          '/api/'
        ]
      }
    ],
    sitemap: `${OFFICIAL_BUSINESS.websiteUrl}/sitemap.xml`,
    host: OFFICIAL_BUSINESS.websiteUrl
  };
}
