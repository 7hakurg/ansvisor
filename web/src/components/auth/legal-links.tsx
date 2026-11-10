import { siteConfig } from '@/config/site';

/**
 * The Terms and Privacy links, each only where the deployment has that page
 * (siteConfig.legal): a link to a page that doesn't exist is worse than none.
 */
export function LegalLinks({
  className,
  linkClassName,
  terms,
  privacy,
}: {
  className?: string;
  linkClassName?: string;
  terms: string;
  privacy: string;
}) {
  const links = [
    { href: siteConfig.legal.terms, label: terms },
    { href: siteConfig.legal.privacy, label: privacy },
  ].filter((link): link is { href: string; label: string } => Boolean(link.href));

  if (links.length === 0) return null;

  return (
    <div className={className}>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
