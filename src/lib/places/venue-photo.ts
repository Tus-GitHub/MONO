/** Public, serializable photo metadata. Private couple data never goes to the photo source. */
export interface VenuePhoto {
  url: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
}
