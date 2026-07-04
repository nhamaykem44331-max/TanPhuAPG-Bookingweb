import '@/components/landing/landing.css';
import '@/components/landing/landing-content.css';
import type { ReactNode } from 'react';
import LandingIcons from './LandingIcons';
import LandingHeader from './LandingHeader';
import { FooterSection } from './LandingSections';
import { SITE_URL } from '@/lib/site';

type Crumb = { name: string; url: string };

export default function LandingShell({
  breadcrumb,
  children,
}: {
  breadcrumb?: Crumb[];
  children: ReactNode;
}) {
  const crumbLd =
    breadcrumb && breadcrumb.length > 0
      ? JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumb.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            item: `${SITE_URL}${c.url}`,
          })),
        }).replace(/</g, '\\u003c')
      : null;

  return (
    <>
      {crumbLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbLd }} />}
      <LandingHeader />
      <div className="lp">
        <LandingIcons />
        <main className="doc-wrap">
        <div className="container">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="doc-crumbs" aria-label="Breadcrumb">
              {breadcrumb.map((c, i) => (
                <span key={c.url}>
                  {i > 0 && <span className="sep"> / </span>}
                  {i < breadcrumb.length - 1 ? <a href={c.url}>{c.name}</a> : <span aria-current="page">{c.name}</span>}
                </span>
              ))}
            </nav>
          )}
          {children}
        </div>
      </main>
      <FooterSection />
      </div>
    </>
  );
}
