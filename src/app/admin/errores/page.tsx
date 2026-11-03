import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { messageFor, Notice } from "@/components/shell/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setErrorStatusAction } from "@/modules/errores/actions";
import {
  countOpenErrors,
  ERRORS_PAGE,
  filterFrom,
  listErrors,
  offsetFrom,
  type ErrorFilter,
  type ErrorLogRow,
} from "@/modules/errores/queries";
import { requirePlatformAdmin } from "@/modules/organizaciones/session";

export const metadata: Metadata = { title: "Errores" };

const MESSAGES: Record<string, string> = {
  resolved: "Error marcado como resuelto. Si vuelve a ocurrir, se reabre solo.",
  ignored: "Error ignorado. No se reabre aunque se repita.",
  open: "Error reabierto.",
  invalido: "No se pudo interpretar el pedido.",
  inexistente: "Ese error ya no existe (se purga con el tiempo).",
  escritura: "No se pudo actualizar el error.",
};

const FILTERS: { value: ErrorFilter; label: string }[] = [
  { value: "open", label: "Abiertos" },
  { value: "resolved", label: "Resueltos" },
  { value: "ignored", label: "Ignorados" },
  { value: "all", label: "Todos" },
];

const STATUS_LABEL: Record<string, string> = { open: "Abierto", resolved: "Resuelto", ignored: "Ignorado" };
const SOURCE_LABEL: Record<string, string> = { server: "Servidor", browser: "Navegador" };

const dateTime = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

function href(filter: ErrorFilter, page: number) {
  return `/admin/errores?estado=${filter}${page > 1 ? `&pagina=${page}` : ""}`;
}

function StatusButton({ id, status, label }: { id: number; status: string; label: string }) {
  return (
    <form action={setErrorStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant="outline">
        {label}
      </Button>
    </form>
  );
}

function ErrorItem({ row }: { row: ErrorLogRow }) {
  return (
    <li className="grid gap-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium break-words">{row.message}</span>
        <span className="text-xs text-muted-foreground">
          {STATUS_LABEL[row.status] ?? row.status} · {SOURCE_LABEL[row.source] ?? row.source}
          {row.severity === "warning" ? " · aviso" : ""}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {row.count} {row.count === 1 ? "vez" : "veces"} · última {dateTime.format(new Date(row.last_at))} · primera{" "}
        {dateTime.format(new Date(row.first_at))}
        {row.route ? <> · {row.route}</> : null}
        {row.digest ? <> · ref. {row.digest}</> : null}
      </p>
      {row.detail ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Detalle técnico</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{row.detail}</pre>
        </details>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {row.status === "open" ? (
          <>
            <StatusButton id={row.id} status="resolved" label="Marcar resuelto" />
            <StatusButton id={row.id} status="ignored" label="Ignorar" />
          </>
        ) : (
          <StatusButton id={row.id} status="open" label="Reabrir" />
        )}
      </div>
    </li>
  );
}

async function ErrorsContent({ searchParams }: Pick<PageProps<"/admin/errores">, "searchParams">) {
  await requirePlatformAdmin();
  const query = await searchParams;
  const filter = filterFrom(query.estado);
  const offset = offsetFrom(query.pagina);
  const page = offset / ERRORS_PAGE + 1;
  const [{ rows, hasMore }, open] = await Promise.all([listErrors(filter, offset), countOpenErrors()]);
  const message = messageFor(query, MESSAGES);

  return (
    <AppShell title="Errores">
      <div className="grid gap-6">
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Card>
          <CardHeader>
            <CardTitle>Errores del sistema ({open} abiertos)</CardTitle>
            <CardDescription>
              Los errores del servidor y del navegador, agrupados: uno repetido suma al contador en vez de duplicarse. No se
              guardan datos de las personas ni de los pedidos. Los resueltos se purgan a los 90 días.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Link
                  key={f.value}
                  href={href(f.value, 1)}
                  aria-current={f.value === filter ? "page" : undefined}
                  className={
                    f.value === filter
                      ? "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                      : "rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                  }
                >
                  {f.label}
                </Link>
              ))}
            </nav>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay errores en esta vista.</p>
            ) : (
              <ul className="divide-y">
                {rows.map((row) => (
                  <ErrorItem key={row.id} row={row} />
                ))}
              </ul>
            )}
            <div className="flex gap-4 text-sm">
              {page > 1 ? (
                <Link href={href(filter, page - 1)} className="underline underline-offset-4">
                  Anteriores
                </Link>
              ) : null}
              {hasMore ? (
                <Link href={href(filter, page + 1)} className="underline underline-offset-4">
                  Siguientes
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function AdminErrorsPage(props: PageProps<"/admin/errores">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}>
      <ErrorsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
