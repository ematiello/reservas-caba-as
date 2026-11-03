import { MapPin, Search as SearchIcon } from "lucide-react";

import type { Search } from "@/modules/publico/search";

// The brand's search bar ("¿Dónde querés ir?", dates, guests): a plain GET to /buscar, no client JS.
// Dates are optional; with them the results keep only properties with a free unit.

const field =
  "h-11 w-full rounded-lg border border-[var(--input)] bg-white px-3 text-brand-slate focus-visible:border-brand-green focus-visible:ring-2 focus-visible:ring-brand-olive/50 focus-visible:outline-none";

// `today` sets the date pickers' minimum where the page renders per request; the static home omits it
// (the server checks past dates anyway).
export function SearchBar({ today, values }: { today?: string; values?: Partial<Search> }) {
  return (
    <form
      method="get"
      action="/buscar"
      role="search"
      className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 shadow-raised ring-1 ring-[var(--border)] md:grid-cols-[minmax(0,1.6fr)_1fr_1fr_7rem_auto] md:items-end"
    >
      <label className="col-span-2 grid gap-1 text-sm font-semibold md:col-span-1">
        ¿Dónde querés ir?
        <span className="relative">
          <MapPin aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-5 text-brand-green" strokeWidth={1.75} />
          <input
            type="search"
            name="q"
            maxLength={80}
            placeholder="Localidad o nombre del alojamiento"
            defaultValue={values?.query ?? ""}
            className={`${field} pl-10 font-normal`}
          />
        </span>
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Fecha de ingreso
        <input type="date" name="ingreso" min={today} defaultValue={values?.checkIn ?? ""} className={`${field} font-normal`} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Fecha de egreso
        <input type="date" name="salida" min={today} defaultValue={values?.checkOut ?? ""} className={`${field} font-normal`} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Huéspedes
        <input
          type="number"
          name="huespedes"
          min={1}
          max={50}
          defaultValue={values?.guests ?? ""}
          placeholder="2"
          className={`${field} font-normal`}
        />
      </label>
      <button
        type="submit"
        className="font-display inline-flex h-11 items-center self-end justify-center gap-2 rounded-full bg-brand-ochre px-6 font-semibold text-brand-slate hover:bg-brand-ochre-deep focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <SearchIcon aria-hidden="true" className="size-5" strokeWidth={2} />
        Buscar
      </button>
    </form>
  );
}
