import type { Metadata } from "next";

// The platform admin is never indexable, even after the root layout drops its launch-time
// noindex. Authorization stays in each page.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
