"use client";

import {
  Activity,
  Building,
  Building2,
  Calendar,
  CalendarDays,
  CirclePlus,
  CreditCard,
  Ellipsis,
  House,
  LogIn,
  Search,
  Settings,
  Shield,
  TriangleAlert,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { isActive, splitBottomNav, type NavIcon, type NavItem } from "./nav";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  search: Search,
  "circle-plus": CirclePlus,
  "log-in": LogIn,
  calendar: Calendar,
  users: Users,
  house: House,
  "calendar-days": CalendarDays,
  "user-cog": UserCog,
  "credit-card": CreditCard,
  building: Building,
  "building-2": Building2,
  settings: Settings,
  activity: Activity,
  "triangle-alert": TriangleAlert,
  shield: Shield,
};

function ItemIcon({ icon, className }: { icon?: NavIcon; className?: string }) {
  const Icon = icon ? ICONS[icon] : Ellipsis;
  return <Icon aria-hidden="true" className={className ?? "size-6"} strokeWidth={1.75} />;
}

type BottomNavProps = {
  items: NavItem[];
  /** Accessible name of the navigation landmark. */
  label: string;
  /** Link to the other area (panel/admin); lives in the "Más" sheet. */
  extra?: { href: string; label: string } | null;
};

// Phone-only bar fixed at the bottom (below `md`). It only navigates: every page still authorizes
// itself. With more than five items the fifth slot is "Más", which opens a sheet with the rest.
export function BottomNav({ items, label, extra = null }: BottomNavProps) {
  const path = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);
  const { primary, overflow } = splitBottomNav(items);
  const hasMore = overflow.length > 0 || extra !== null;
  const moreActive = overflow.some((item) => isActive(item, path));

  // Close the sheet once the navigation lands.
  useEffect(() => {
    sheet.current?.close();
  }, [path]);

  if (items.length === 0) return null;

  const slot =
    "font-heading flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight font-semibold focus-visible:bg-white/10 focus-visible:outline-none";
  const tone = (active: boolean) => (active ? "text-brand-ochre" : "text-brand-sand/80");

  return (
    <>
      <nav
        aria-label={label}
        className="bg-brand-green-deep fixed inset-x-0 bottom-0 z-40 border-t border-white/10 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex">
          {primary.map((item) => {
            const active = isActive(item, path);
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link href={item.href} aria-current={active ? "page" : undefined} className={`${slot} ${tone(active)}`}>
                  <ItemIcon icon={item.icon} />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          {hasMore ? (
            <li className="min-w-0 flex-1">
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => sheet.current?.showModal()}
                className={`${slot} ${tone(moreActive)}`}
              >
                <Ellipsis aria-hidden="true" className="size-6" strokeWidth={1.75} />
                <span>Más</span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      {hasMore ? (
        <dialog
          ref={sheet}
          aria-labelledby="bottom-nav-more"
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close();
          }}
          className="bg-brand-paper text-brand-slate m-0 mt-auto w-full max-w-none rounded-t-2xl p-0 backdrop:bg-black/40 md:hidden"
        >
          <div className="px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <h2 id="bottom-nav-more" className="font-heading text-lg font-bold">
                Más opciones
              </h2>
              <button
                type="button"
                onClick={() => sheet.current?.close()}
                className="font-heading rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:outline-none"
              >
                Cerrar
              </button>
            </div>
            <ul className="mt-2 divide-y divide-black/10">
              {overflow.map((item) => {
                const active = isActive(item, path);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-12 items-center gap-3 py-2 font-semibold focus-visible:outline-none ${
                        active ? "text-brand-green" : ""
                      }`}
                    >
                      <ItemIcon icon={item.icon} className="size-5" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {extra ? (
              <Link
                href={extra.href}
                className="bg-brand-ochre text-brand-slate hover:bg-brand-ochre-deep font-heading mt-3 block rounded-full px-4 py-3 text-center font-semibold focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:outline-none"
              >
                {extra.label}
              </Link>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
