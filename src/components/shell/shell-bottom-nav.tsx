"use client";

import { usePathname } from "next/navigation";

import { BottomNav } from "./bottom-nav";
import { resolveArea, type NavItem } from "./nav";

// Bottom bar of the private areas: same items and area switch as the top tabs (ShellNav), picked
// by the current path, which only the client knows.
export function ShellBottomNav({ panel, admin }: { panel: NavItem[] | null; admin: NavItem[] | null }) {
  const { items, label, other } = resolveArea(usePathname(), panel, admin);
  return <BottomNav items={items} label={label} extra={other} />;
}
