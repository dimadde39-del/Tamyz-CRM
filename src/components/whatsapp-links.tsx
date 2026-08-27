import { MessageCircle } from "lucide-react";

import { buildWhatsAppLinks } from "@/lib/phone";

interface WhatsAppLinksProps {
  phone?: string | null;
  whatsapp?: string | null;
  className?: string;
  label?: string;
}

const MAX_VISIBLE_LINKS = 3;

/** Renders up to three safe, manually opened WhatsApp links without overcrowding a card. */
export function WhatsAppLinks({
  phone,
  whatsapp,
  className = "btn",
  label = "WhatsApp",
}: WhatsAppLinksProps) {
  const links = buildWhatsAppLinks(whatsapp, phone);
  const visibleLinks = links.slice(0, MAX_VISIBLE_LINKS);
  const showNumber = links.length > 1;

  return (
    <>
      {visibleLinks.map(({ number, url }) => (
        <a
          className={className}
          href={url}
          key={number}
          target="_blank"
          rel="noopener noreferrer"
          title={`WhatsApp: +${number}`}
        >
          <MessageCircle aria-hidden="true" size={15} />
          {label}{showNumber ? ` +${number}` : ""}
        </a>
      ))}
      {links.length > MAX_VISIBLE_LINKS ? (
        <span
          className="self-center text-[11px] text-[var(--muted)]"
          title={links.slice(MAX_VISIBLE_LINKS).map(({ number }) => `+${number}`).join(", ")}
        >
          ещё {links.length - MAX_VISIBLE_LINKS}
        </span>
      ) : null}
    </>
  );
}
