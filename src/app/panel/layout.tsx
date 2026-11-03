import type { Metadata } from "next";

// The owner panel and guest data are never indexable (CLAUDE.md), even after the public site
// drops the launch-time noindex in the root layout. Authorization stays in each page.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return children;
}
