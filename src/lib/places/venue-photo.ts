/** Public, serializable photo metadata. Private couple data never goes to the photo source. */
export interface CommonsVenuePhoto {
  source?: "commons";
  url: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
}

export interface IndiaRestrosVenuePhoto {
  source: "indiarestros";
  url: string;
  sourceUrl: string;
  venueAddress?: string;
}

export type VenuePhoto = CommonsVenuePhoto | IndiaRestrosVenuePhoto;

export interface PhotoVenue {
  providerPlaceId: string;
  name: string;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
}
