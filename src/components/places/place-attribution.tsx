/** Shared by server pages and the client picker; never imports provider config or keys. */
export function PlaceAttribution({ provider }: { provider: string | null | undefined }) {
  if (provider !== "photon") return null;
  return (
    <p className="text-xs text-faint">
      Place data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">OpenStreetMap contributors</a>
      {" · "}<a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Search by Photon</a>
    </p>
  );
}
