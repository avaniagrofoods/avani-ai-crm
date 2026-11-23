import type { MetadataRoute } from 'next';
import {
  OFFICIAL_BUSINESS,
  PUBLIC_BLOG_ARTICLES,
  PUBLIC_LOAN_SERVICES
} from '@/config/public-website';

/**
 * Generates canonical public-only XML sitemap for https://www.avanifinserv.com/sitemap.xml.
 * Strictly excludes CRM routes, /login, admin pages, and /api/* endpoints.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = OFFICIAL_BUSINESS.websiteUrl;
  const lastModified = new Date('2026-11-21T00:00:00.000Z');

  const coreEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/about`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/services`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/blog`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/contact`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/enquiry`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/disclaimer`, lastModified, changeFrequency: 'yearly', priority: 0.4 }
  ];

  const serviceEntries: MetadataRoute.Sitemap = PUBLIC_LOAN_SERVICES.map((svc) => ({
    url: `${base}/services/${svc.slug}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: svc.coreOfficial ? 0.85 : 0.75
  }));

  const blogEntries: MetadataRoute.Sitemap = PUBLIC_BLOG_ARTICLES.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(`${post.updatedDate}T00:00:00.000Z`),
    changeFrequency: 'monthly',
    priority: 0.7
  }));

  return [...coreEntries, ...serviceEntries, ...blogEntries];
}
