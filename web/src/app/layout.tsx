import type { Metadata } from 'next';
import { Geist, Geist_Mono, Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { PostHogProvider } from '@/components/providers/posthog-provider';
import './globals.css';
import { siteConfig } from '@/config/site';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.appUrl),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description:
    "Monitor, analyze, and optimize your brand's visibility in AI-powered search engines.",
  openGraph: {
    title: siteConfig.name,
    description:
      'Track how AI search engines mention your brand — ChatGPT, Gemini, Google AI, Claude.',
    url: '/',
    siteName: siteConfig.name,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description:
      'Track how AI search engines mention your brand — ChatGPT, Gemini, Google AI, Claude.',
  },
  // The product app should not appear in search results; the marketing site
  // (siteConfig.url) is the indexable surface.
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jakarta.variable}`}
    >
      <body suppressHydrationWarning className="font-sans antialiased">
        <PostHogProvider />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
