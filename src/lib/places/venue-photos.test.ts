import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({india:vi.fn(),commons:vi.fn()}));
vi.mock("./indiarestros-photos",()=>({IndiaRestrosPhotos:class{lookup=mocks.india}}));
vi.mock("./wikimedia-photos",()=>({venuePhotos:{lookup:mocks.commons}}));
import { lookupVenuePhotos } from "./venue-photos";
const place={providerPlaceId:"N1:28:77:amenity:cafe",name:"Test Cafe",category:"CAFE",latitude:28,longitude:77};
beforeEach(()=>{vi.resetAllMocks();mocks.india.mockResolvedValue(new Map());mocks.commons.mockResolvedValue(new Map())});
it("prefers IndiaRestros and only asks Commons for the remaining venues",async()=>{
 const india={source:"indiarestros",url:"india",sourceUrl:"listing"};const commons={url:"commons",sourceUrl:"file",author:"Alex",license:"CC BY",licenseUrl:"license"};
 mocks.india.mockResolvedValue(new Map([[place.providerPlaceId,india]]));mocks.commons.mockResolvedValue(new Map([["second",commons]]));
 const result=await lookupVenuePhotos([place,{...place,providerPlaceId:"second"}]);expect(mocks.commons).toHaveBeenCalledWith(["second"]);expect(result.get(place.providerPlaceId)).toBe(india);expect(result.get("second")).toBe(commons);
});
it("keeps Commons working when IndiaRestros fails",async()=>{
 mocks.india.mockRejectedValue(new Error("outage"));await lookupVenuePhotos([place]);expect(mocks.commons).toHaveBeenCalledWith([place.providerPlaceId]);
});
