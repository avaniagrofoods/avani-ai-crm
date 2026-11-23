import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react';
import {
  OFFICIAL_BUSINESS,
  PUBLIC_BLOG_ARTICLES,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildOfficialWhatsAppUrl,
  getPublicBlogArticleBySlug,
  getPublicLoanServiceBySlug
} from '@/config/public-website';
import { PublicShell } from '@/components/public/public-shell';
import { JsonLdScript } from '@/components/public/json-ld';

export function generateStaticParams() {
  return PUBLIC_BLOG_ARTICLES.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getPublicBlogArticleBySlug(slug);
  if (!article) {
    return { title: 'Article Not Found', robots: { index: false, follow: false } };
  }
  return {
    title: article.metaTitle,
    description: article.metaDescription,
    alternates: {
      canonical: `/blog/${article.slug}`
    },
    openGraph: {
      title: article.metaTitle,
      description: article.metaDescription,
      url: `${OFFICIAL_BUSINESS.websiteUrl}/blog/${article.slug}`,
      type: 'article',
      publishedTime: article.publishedDate,
      modifiedTime: article.updatedDate,
      authors: [OFFICIAL_BUSINESS.ownerFounder]
    }
  };
}

export default async function BlogArticlePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getPublicBlogArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  const relatedServices = article.relatedServiceSlugs
    .map((s) => getPublicLoanServiceBySlug(s))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const whatsappUrl = buildOfficialWhatsAppUrl();

  return (
    <PublicShell>
      <JsonLdScript id={`ld-article-${article.slug}`} data={buildArticleJsonLd(article)} />
      <JsonLdScript
        id={`ld-breadcrumb-blog-${article.slug}`}
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Blogs / Resources', path: '/blog' },
          { name: article.title, path: `/blog/${article.slug}` }
        ])}
      />

      <article className="bg-white">
        <header className="bg-[#EFF8FE] border-b border-[#E2EAF0] py-10 sm:py-14">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
            <nav aria-label="Breadcrumb" className="text-xs text-[#64748B] flex flex-wrap items-center gap-2">
              <Link href="/" className="hover:text-[#176B9A]">
                Home
              </Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-[#176B9A]">
                Blogs
              </Link>
              <span>/</span>
              <span className="font-semibold text-[#176B9A]">{article.category}</span>
            </nav>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-[#253447] leading-tight">
              {article.h1}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
              <span className="font-semibold text-[#176B9A]">{article.author}</span>
              <span>•</span>
              <span>
                Published: <time dateTime={article.publishedDate}>{article.publishedDate}</time>
              </span>
              <span>•</span>
              <span>
                Updated: <time dateTime={article.updatedDate}>{article.updatedDate}</time>
              </span>
              <span>•</span>
              <span>{article.readingTime}</span>
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-8">
          <figure className="rounded-2xl border border-[#E2EAF0] bg-[#EFF8FE]/40 p-3">
            <img
              src={article.imagePath}
              alt={article.imageAlt}
              width={600}
              height={440}
              loading="lazy"
              className="w-full h-auto rounded-xl"
            />
          </figure>

          <p className="text-base text-[#253447] leading-relaxed font-medium">{article.intro}</p>

          {article.sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-xl font-bold text-[#176B9A]">{section.heading}</h2>
              {section.paragraphs.map((p) => (
                <p key={p} className="text-sm sm:text-base text-[#253447] leading-relaxed">
                  {p}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[#253447]">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {/* Article CTA */}
          <div className="rounded-2xl bg-[#FBF6E9] border border-[#E8CF91] p-6 space-y-3">
            <h2 className="text-lg font-bold text-[#176B9A]">
              Need Personalised Loan Consultancy?
            </h2>
            <p className="text-sm text-[#253447]">
              Speak with {OFFICIAL_BUSINESS.name} ({OFFICIAL_BUSINESS.ownerFounder}) in Latur, Maharashtra for general
              product awareness and application coordination. All lending decisions remain subject to lender policy.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/enquiry"
                className="inline-flex items-center gap-2 rounded-xl bg-[#38A9E8] hover:bg-[#176B9A] text-white px-5 py-2.5 text-xs font-bold"
              >
                <span>Submit Loan Enquiry</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#E8CF91] text-[#176B9A] px-5 py-2.5 text-xs font-bold"
              >
                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>WhatsApp: {OFFICIAL_BUSINESS.whatsappDisplay}</span>
              </a>
            </div>
          </div>

          {/* Related Services */}
          {relatedServices.length > 0 && (
            <div className="pt-6 border-t border-[#E2EAF0] space-y-3">
              <h2 className="text-base font-bold text-[#253447]">Related Loan Services</h2>
              <div className="flex flex-wrap gap-2">
                {relatedServices.map((svc) => (
                  <Link
                    key={svc.slug}
                    href={`/services/${svc.slug}`}
                    className="px-3.5 py-2 rounded-xl bg-[#EFF8FE] hover:bg-[#38A9E8]/15 border border-[#E2EAF0] text-xs font-semibold text-[#176B9A]"
                  >
                    {svc.name} →
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#176B9A] hover:text-[#38A9E8]"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to All Articles</span>
            </Link>
          </div>
        </div>
      </article>
    </PublicShell>
  );
}
