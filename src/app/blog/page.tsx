import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import {
  OFFICIAL_BUSINESS,
  PUBLIC_BLOG_ARTICLES,
  buildBreadcrumbJsonLd
} from '@/config/public-website';
import { PublicShell } from '@/components/public/public-shell';
import { JsonLdScript } from '@/components/public/json-ld';

export const metadata: Metadata = {
  title: 'Blogs & Financial Guides',
  description:
    'Educational loan planning guides and articles from AVANI LOAN SERVICES covering Home Loans, Business Loans, MSME, Doctor Loans, Education Loans and Institutional Funding.',
  alternates: {
    canonical: '/blog'
  },
  openGraph: {
    title: `Blogs & Financial Guides | ${OFFICIAL_BUSINESS.name}`,
    description: 'Accurate, practical loan planning articles by AVANI LOAN SERVICES.',
    url: `${OFFICIAL_BUSINESS.websiteUrl}/blog`,
    type: 'website'
  }
};

export default function BlogIndexPage() {
  return (
    <PublicShell>
      <JsonLdScript
        id="ld-breadcrumb-blog"
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Blogs & Resources', path: '/blog' }
        ])}
      />

      <section className="bg-[#EFF8FE] border-b border-[#E2EAF0] py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <nav aria-label="Breadcrumb" className="text-xs text-[#64748B] flex items-center gap-2">
            <Link href="/" className="hover:text-[#176B9A]">
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#176B9A]">Blogs / Resources</span>
          </nav>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#176B9A]">
            <BookOpen className="w-4 h-4 text-[#38A9E8]" aria-hidden="true" />
            <span>Educational Resources</span>
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#253447] tracking-tight">
            Loan Advisory Guides &amp; Articles
          </h1>
          <p className="text-base text-[#64748B] max-w-3xl leading-relaxed">
            Practical educational guides prepared by {OFFICIAL_BUSINESS.name} to help individuals, families,
            professionals, businesses and educational institutions prepare responsibly before submitting a formal loan
            application.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {PUBLIC_BLOG_ARTICLES.map((post) => (
            <article
              key={post.slug}
              className="rounded-2xl bg-white border border-[#E2EAF0] hover:border-[#38A9E8] hover:shadow-md transition-all p-6 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EFF8FE] text-[#176B9A] font-semibold">
                    {post.category}
                  </span>
                  <span>•</span>
                  <time dateTime={post.publishedDate}>{post.publishedDate}</time>
                  <span>•</span>
                  <span>{post.readingTime}</span>
                </div>
                <h2 className="text-lg font-bold text-[#253447] leading-snug">
                  <Link href={`/blog/${post.slug}`} className="hover:text-[#176B9A]">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-sm text-[#64748B] leading-relaxed">{post.intro}</p>
              </div>
              <div className="mt-5 pt-4 border-t border-[#E2EAF0] flex items-center justify-between text-xs">
                <span className="text-[#64748B] font-medium">{post.author}</span>
                <Link
                  href={`/blog/${post.slug}`}
                  className="font-bold text-[#176B9A] hover:text-[#38A9E8] inline-flex items-center gap-1"
                >
                  <span>Read Article</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
