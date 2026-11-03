import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/modules/reservas/calendar";
import type { Holiday } from "@/modules/tarifas/queries";

export const HOLIDAY_MESSAGES: Record<string, string> = {
  feriado: "Feriado agregado.",
  feriado_borrado: "Feriado borrado.",
  feriado_invalido: "Revisá la fecha y el nombre.",
  feriado_repetido: "Ya hay un feriado en esa fecha.",
  feriado_error: "No se pudo guardar el feriado.",
};

/** Add form plus the list with a delete button per holiday. Without actions, a read-only list. */
export function HolidayEditor({
  holidays,
  addAction,
  deleteAction,
  empty,
}: {
  holidays: Holiday[];
  addAction?: (formData: FormData) => Promise<void>;
  deleteAction?: (formData: FormData) => Promise<void>;
  empty: string;
}) {
  return (
    <div className="grid gap-4">
      {addAction ? (
        <form action={addAction} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="holidayDate">Fecha</Label>
            <Input id="holidayDate" name="date" type="date" required />
          </div>
          <div className="grid min-w-48 flex-1 gap-1.5">
            <Label htmlFor="holidayName">Nombre</Label>
            <Input id="holidayName" name="name" required maxLength={80} />
          </div>
          <Button type="submit">Agregar</Button>
        </form>
      ) : null}
      {holidays.length ? (
        <ul className="grid gap-2 text-sm">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2">
              <span>
                <span className="font-semibold">{formatDate(h.date)}</span> {h.name}
              </span>
              {deleteAction ? (
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={h.id} />
                  <Button type="submit" variant="outline" size="sm" aria-label={`Borrar ${h.name}`}>
                    Borrar
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
