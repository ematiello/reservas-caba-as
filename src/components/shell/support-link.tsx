import { supportHref } from "@/lib/support";

type SupportLinkProps = { className?: string; linkClassName?: string };

// "¿Algún problema? Soporte": opens a WhatsApp chat with the pilot support contact.
export function SupportLink({ className, linkClassName }: SupportLinkProps) {
  return (
    <p className={className}>
      ¿Algún problema? Escribinos a{" "}
      <a
        href={supportHref()}
        target="_blank"
        rel="noopener noreferrer"
        className={`font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand-ochre focus-visible:outline-none ${linkClassName ?? ""}`}
      >
        Soporte
      </a>
    </p>
  );
}
