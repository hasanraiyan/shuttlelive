/**
 * Venue section: embedded Google Map (no API key needed) and a directions
 * button. Hidden when the organizer hasn't entered a venue.
 */
export function VenueMap({ name, address, mapUrl }: { name: string | null; address: string | null; mapUrl: string | null }) {
  const query = [name, address].filter(Boolean).join(", ");
  if (!query) return null;
  const q = encodeURIComponent(query);
  const directions = mapUrl ?? `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  return (
    <section>
      <h2 className="font-display text-3xl">Venue</h2>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          {name && <p className="font-semibold">{name}</p>}
          {address && <p className="text-ink-soft">{address}</p>}
        </div>
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex h-10 items-center rounded-md bg-court px-4 text-sm font-semibold text-court-line hover:bg-court-deep"
        >
          Get directions
        </a>
      </div>
      <iframe
        title={`Map of ${query}`}
        src={`https://www.google.com/maps?q=${q}&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="mt-4 aspect-[16/9] w-full rounded-lg border border-line sm:aspect-[21/9]"
      />
    </section>
  );
}
