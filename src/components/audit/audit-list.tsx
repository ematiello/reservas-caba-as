import Link from "next/link";

import { describeAudit } from "@/modules/auditoria/labels";
import { AUDIT_PAGE, type AuditEntry } from "@/modules/auditoria/queries";

const when = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * The audit log, newest first. `showOrg` adds the organization (platform-wide log). `nextHref`
 * builds the link to the next page from the last id shown.
 */
export function AuditList({
  entries,
  showOrg = false,
  nextHref,
}: {
  entries: AuditEntry[];
  showOrg?: boolean;
  nextHref: (before: number) => string;
}) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No hay movimientos registrados.</p>;
  const last = entries.at(-1)!;
  return (
    <div className="grid gap-3">
      <ol className="divide-y text-sm">
        {entries.map((e) => {
          const { title, detail } = describeAudit(e);
          return (
            <li key={e.id} className="grid gap-0.5 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
              <time dateTime={e.at} className="text-muted-foreground tabular-nums">
                {when.format(new Date(e.at))}
              </time>
              <div className="min-w-0">
                <p>
                  <span className="font-semibold">{title}</span>
                  {showOrg && e.org_name ? <span className="text-muted-foreground"> en {e.org_name}</span> : null}
                </p>
                {detail ? <p className="break-words text-muted-foreground">{detail}</p> : null}
                <p className="text-xs text-muted-foreground">
                  Por {e.actor ?? (e.actor_id ? "Plataforma" : "el sistema (tarea automática)")}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {entries.length === AUDIT_PAGE ? (
        <Link href={nextHref(last.id)} className="text-sm font-semibold underline underline-offset-4">
          Ver movimientos anteriores
        </Link>
      ) : null}
    </div>
  );
}
