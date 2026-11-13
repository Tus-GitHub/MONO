import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IndiaRestrosPhotos } from "./indiarestros-photos";
import type { PhotoVenue } from "./venue-photo";

const place:PhotoVenue={providerPlaceId:"N6957678134:28.6022338:77.1861298:amenity:cafe",name:"Starbucks",category:"CAFE",latitude:28.6022338,longitude:77.1861298};
const record=()=>({id:"IRR-8SPCQG2J88",name:"Starbucks",kind:"cafe",lat:28.602234,lon:77.18613,photo_count:1,url:"https://indiarestros.com/r/starbucks-new-delhi-8spcqg2j88",photos:[{thumb:"/img/IRR-8SPCQG2J88/37acc41ca6c9-480.webp",alt:"Starbucks in New Delhi"}]});
const response=(rows:unknown[]= [record()],control="public, max-age=86400")=>Response.json({results:rows},{headers:{"Cache-Control":control}});
let fetcher:ReturnType<typeof vi.fn>;
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-13"));fetcher=vi.fn();vi.stubGlobal("fetch",fetcher)});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});

it("matches a real Indian cafe by name and coordinates, with source link but no invented license",async()=>{
 fetcher.mockResolvedValue(response());const photos=await new IndiaRestrosPhotos().lookup([place]);
 expect(photos.get(place.providerPlaceId)).toEqual({source:"indiarestros",url:"https://indiarestros.com/img/IRR-8SPCQG2J88/37acc41ca6c9-480.webp",sourceUrl:record().url});
 const [url,options]=fetcher.mock.calls[0];expect(url.origin).toBe("https://indiarestros.com");expect(url.searchParams.get("q")).toBe("Starbucks");expect(url.searchParams.get("lat")).toBe(String(place.latitude));expect(options.headers["User-Agent"]).toContain("MONO");expect(url.searchParams.has("apiKey")).toBe(false);
});
it("skips foreign places, other categories, generic names, mismatched ID coordinates and invalid input",async()=>{
 const service=new IndiaRestrosPhotos();await service.lookup([{...place,latitude:48.8,longitude:2.3},{...place,category:"PARK"},{...place,name:"Cafe"},{...place,latitude:28.7},{...place,longitude:NaN},{...place,providerPlaceId:"malformed"}]);expect(fetcher).not.toHaveBeenCalled();
});
it("rejects an identically named distant branch and an unrelated nearby cafe",async()=>{
 fetcher.mockResolvedValue(response([{...record(),lat:28.9},{...record(),name:"Different Coffee"}]));expect((await new IndiaRestrosPhotos().lookup([place])).size).toBe(0);
});
it("rejects ambiguously close same-name listings, even when one is nearer",async()=>{
 fetcher.mockResolvedValue(response([record(),{...record(),id:"IRR-ABCDEFGHIJ",lat:28.6023}]));expect((await new IndiaRestrosPhotos().lookup([place])).size).toBe(0);
});
it("does not confuse a restaurant with an identically named cafe",async()=>{
 fetcher.mockResolvedValue(response([{...record(),kind:"restaurant"}]));expect((await new IndiaRestrosPhotos().lookup([place])).size).toBe(0);
});
it("rejects generic candidate names and longitude wraparound instead of matching a wrong place",async()=>{
 fetcher.mockResolvedValue(response([{...record(),lon:record().lon+360},{...record(),name:"Cafe"}]));expect((await new IndiaRestrosPhotos().lookup([place,{...place,providerPlaceId:place.providerPlaceId.replace("N6957678134","N3"),name:"Cafe Starbucks"}])).size).toBe(0);
});
it.each(["remote host","another venue path","representative","missing photos","invalid source link"])("skips %s and leaves Commons available",async reason=>{
 const row=record();if(reason==="remote host")row.photos[0].thumb="https://attacker.invalid/photo.webp";
 if(reason==="another venue path")row.photos[0].thumb="/img/IRR-ABCDEFGHIJ/37acc41ca6c9-480.webp";
 if(reason==="representative")row.photos[0].alt="Representative photo of coffee";
 if(reason==="missing photos")row.photo_count=0;
 if(reason==="invalid source link")row.url="https://attacker.invalid/r/cafe";
 fetcher.mockResolvedValue(response([row]));expect((await new IndiaRestrosPhotos().lookup([place])).size).toBe(0);
});
it("batches same-name nearby venues and coalesces simultaneous calls",async()=>{
 fetcher.mockResolvedValue(response());const service=new IndiaRestrosPhotos();await Promise.all([service.lookup([place,{...place,providerPlaceId:"N2:28.61:77.19:amenity:cafe",latitude:28.61,longitude:77.19}]),service.lookup([place])]);expect(fetcher).toHaveBeenCalledTimes(1);
 await service.lookup([place]);expect(fetcher).toHaveBeenCalledTimes(1);
});
it("bounds a batch to four distinct name/area requests",async()=>{
 fetcher.mockResolvedValue(response([]));const names=Array.from({length:20},(_,i)=>({...place,name:`Cafe ${i}`}));await new IndiaRestrosPhotos().lookup(names);expect(fetcher).toHaveBeenCalledTimes(4);
});
it("expires cache according to the source's max-age, including negative matches",async()=>{
 fetcher.mockResolvedValue(response([],"public, max-age=10"));const service=new IndiaRestrosPhotos();await service.lookup([place]);await vi.advanceTimersByTimeAsync(9000);await service.lookup([place]);expect(fetcher).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(2000);await service.lookup([place]);expect(fetcher).toHaveBeenCalledTimes(2);
});
it("honors Retry-After across other venue lookups and then recovers",async()=>{
 fetcher.mockResolvedValueOnce(new Response(null,{status:429,headers:{"Retry-After":"120"}})).mockResolvedValue(response());const service=new IndiaRestrosPhotos();await service.lookup([place]);await vi.advanceTimersByTimeAsync(61000);await service.lookup([{...place,name:"Starbucks Coffee"}]);expect(fetcher).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(60000);expect((await service.lookup([place])).size).toBe(1);
});
it("returns no IndiaRestros photo on timeout or malformed results so Commons can be used",async()=>{
 fetcher.mockRejectedValue(new Error("timeout"));expect((await new IndiaRestrosPhotos().lookup([place])).size).toBe(0);
 fetcher.mockResolvedValue(Response.json({results:{}}));expect((await new IndiaRestrosPhotos().lookup([place])).size).toBe(0);
});
