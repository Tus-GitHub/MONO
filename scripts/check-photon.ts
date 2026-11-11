import { PhotonPlacesProvider } from "../src/lib/places/photon-provider";

async function main() {
  const query = process.argv[2] || "Starbucks Delhi";
  const provider = new PhotonPlacesProvider();
  const results = await provider.search({ text: query, limit: 3 });
  if (!results.length) throw new Error("No mapped venues returned. Try a venue name with its city, or cafes in a city.");
  console.log(`PASS keyless search: ${results.length} venue(s)`);
  for (const place of results) console.log(`  ${place.name} — ${place.address ?? place.city ?? ""}`);
  const detail = await provider.details(results[0].providerPlaceId);
  if (!detail || detail.providerPlaceId.split(":")[0] !== results[0].providerPlaceId.split(":")[0]) throw new Error("Selected OSM venue lookup did not match.");
  console.log(`PASS exact selected venue lookup: ${detail.name}`);
  console.log("No API key, account or billing is used. Public Photon availability is best effort.");
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
