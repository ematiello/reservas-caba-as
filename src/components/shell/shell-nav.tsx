"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  /** Active only on the exact path (section home pages). */
  exact?: boolean;
  /** Other path prefixes that belong to this item. */
  also?: string[];
};

function isActive(item: NavItem, path: string): boolean {
  const under = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (item.also?.some(under)) return true;
  return item.exact ? path === item.href : under(item.href);
}

// Section tabs of the private areas. The admin area and the owner panel each show their own tabs,
// plus a link to switch to the other area when the user has both.
export function ShellNav({ panel, admin }: { panel: NavItem[] | null; admin: NavItem[] | null }) {
  const path = usePathname();
  const inAdmin = path === "/admin" || path.startsWith("/admin/");
  const items = (inAdmin ? admin : panel) ?? [];
  const other = inAdmin
    ? panel && { href: "/panel", label: "Ir al panel" }
    : admin && { href: "/admin", label: "Administración" };

  return (
    <nav aria-label={inAdmin ? "Administración" : "Panel"} className="mx-auto w-full max-w-6xl px-2">
      <ul className="flex items-end gap-1 overflow-x-auto text-sm [scrollbar-width:none]">
        {items.map((item) => {
          const active = isActive(item, path);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`font-heading block border-b-[3px] px-3 py-2.5 font-semibold focus-visible:bg-white/10 focus-visible:outline-none ${
                  active ? "border-brand-ochre text-white" : "border-transparent text-brand-sand/80 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        {other ? (
          <li className="ml-auto shrink-0 pl-3">
            <Link
              href={other.href}
              className="mb-1.5 block rounded-full bg-brand-ochre px-3.5 py-1.5 font-semibold text-brand-slate hover:bg-[#d9913a] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              {other.label}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
