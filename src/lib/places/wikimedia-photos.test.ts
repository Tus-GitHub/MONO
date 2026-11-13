import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WikimediaVenuePhotos } from "./wikimedia-photos";

const id="N1454687141:48.8:2.3:amenity:restaurant";
const title="File:Venue photo.jpg";
const binding=(node="1454687141",image="http://commons.wikimedia.org/wiki/Special:FilePath/Venue%20photo.jpg")=>({type:{value:"N"},id:{value:node},item:{value:"http://www.wikidata.org/entity/Q123"},image:{value:image}});
const info=()=>({thumburl:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Venue_photo.jpg/800px-Venue_photo.jpg",mime:"image/jpeg",extmetadata:{Artist:{value:'<a href="/wiki/User:Alex">Alex &amp; Co</a>'},LicenseShortName:{value:"CC BY-SA 4.0"},LicenseUrl:{value:"https://creativecommons.org/licenses/by-sa/4.0/"}}});
const source=(bindings=[binding()])=>Response.json({results:{bindings}});
const commons=(image=info())=>Response.json({query:{pages:[{title,imageinfo:[image]}]}});
let fetcher:ReturnType<typeof vi.fn>;
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-13"));fetcher=vi.fn();vi.stubGlobal("fetch",fetcher)});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});

it("matches exact public OSM IDs, batches Commons metadata and returns full photo credit",async()=>{
 fetcher.mockResolvedValueOnce(source()).mockResolvedValueOnce(commons());
 const result=await new WikimediaVenuePhotos().lookup([id]);
 expect(result.get(id)).toMatchObject({author:"Alex & Co",license:"CC BY-SA 4.0",sourceUrl:"https://commons.wikimedia.org/wiki/File%3AVenue%20photo.jpg"});
 expect(fetcher).toHaveBeenCalledTimes(2);
 const [url,options]=fetcher.mock.calls[0];expect(url.origin).toBe("https://query.wikidata.org");expect(url.searchParams.get("query")).toContain('VALUES ?id { "1454687141" }');
 expect(options.headers["User-Agent"]).toContain("MONO");expect(url.href).not.toContain("apiKey");
 expect(fetcher.mock.calls[1][0].origin).toBe("https://commons.wikimedia.org");
});
it("ignores another venue, brand or untrusted host instead of showing an unrelated photo",async()=>{
 fetcher.mockResolvedValue(source([binding("999"),binding("1454687141","https://attacker.invalid/file.jpg")]));
 expect((await new WikimediaVenuePhotos().lookup([id])).size).toBe(0);expect(fetcher).toHaveBeenCalledTimes(1);
});
it("accepts Commons' current thumbnail domain and a license URL without trailing slash",async()=>{
 const image=info();image.thumburl=image.thumburl.replace("upload.wikimedia.org","thumb.wikimedia.org");image.extmetadata.LicenseUrl.value="https://creativecommons.org/licenses/by-sa/4.0";
 fetcher.mockResolvedValueOnce(source()).mockResolvedValueOnce(commons(image));expect((await new WikimediaVenuePhotos().lookup([id])).get(id)?.url).toContain("https://thumb.wikimedia.org/");
});
it("rejects malformed identifiers and unsafe coordinates without sending a request",async()=>{
 expect((await new WikimediaVenuePhotos().lookup(["N1 OR ?s ?p ?o", "N1:91:2:amenity:cafe","https://attacker.invalid"])).size).toBe(0);expect(fetcher).not.toHaveBeenCalled();
});
it("uses the correct separate properties for ways and relations, capped at 24 public IDs",async()=>{
 fetcher.mockResolvedValue(source([]));await new WikimediaVenuePhotos().lookup(["W2:1:2:amenity:cafe","R3:1:2:amenity:cafe",...Array.from({length:30},(_,i)=>`N${i+10}:1:2:amenity:cafe`)]);
 const query=fetcher.mock.calls[0][0].searchParams.get("query");expect(query).toContain("wdt:P10689");expect(query).toContain("wdt:P402");expect(query).not.toContain('"32"');
});
it("coalesces concurrent requests and caches public matches across coordinate changes",async()=>{
 fetcher.mockResolvedValueOnce(source()).mockResolvedValueOnce(commons());const service=new WikimediaVenuePhotos();
 await Promise.all([service.lookup([id]),service.lookup([id])]);expect(fetcher).toHaveBeenCalledTimes(2);
 expect((await service.lookup([id.replace("48.8","48.81")])).size).toBe(1);expect(fetcher).toHaveBeenCalledTimes(2);
});
it("caches missing photos, keeping ordinary venues free of repeated failed lookups",async()=>{
 fetcher.mockResolvedValue(source([]));const service=new WikimediaVenuePhotos();await service.lookup([id]);await service.lookup([id]);expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each(["unsafe thumbnail","unknown license","missing author","restricted photo"])("falls back for %s",async reason=>{
 const image=info();if(reason==="unsafe thumbnail")image.thumburl="https://upload.wikimedia.org.attacker.invalid/pic.jpg";
 if(reason==="unknown license")image.extmetadata.LicenseUrl.value="https://attacker.invalid/license";
 if(reason==="missing author")image.extmetadata.Artist.value="";
 if(reason==="restricted photo")Object.assign(image.extmetadata,{Restrictions:{value:"trademark"}});
 fetcher.mockResolvedValueOnce(source()).mockResolvedValueOnce(commons(image));expect((await new WikimediaVenuePhotos().lookup([id])).size).toBe(0);
});
it("backs off after throttling and recovers without calling a paid provider",async()=>{
 fetcher.mockResolvedValueOnce(new Response(null,{status:429,headers:{"Retry-After":"120"}})).mockResolvedValue(source([]));const service=new WikimediaVenuePhotos();
 await service.lookup([id]);await vi.advanceTimersByTimeAsync(61000);await service.lookup([id]);expect(fetcher).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(60000);await service.lookup([id]);expect(fetcher).toHaveBeenCalledTimes(2);
});
it("treats malformed and unavailable upstream responses as missing photos",async()=>{
 fetcher.mockRejectedValue(new Error("unavailable"));expect((await new WikimediaVenuePhotos().lookup([id])).size).toBe(0);
});
it("honors an HTTP-date Retry-After and custom attribution requested by the photographer",async()=>{
 const image=info();Object.assign(image.extmetadata,{Attribution:{value:"Photo courtesy of Alex"}});
 fetcher.mockResolvedValueOnce(new Response(null,{status:429,headers:{"Retry-After":new Date(Date.now()+120000).toUTCString()}})).mockResolvedValueOnce(source()).mockResolvedValueOnce(commons(image));
 const service=new WikimediaVenuePhotos();await service.lookup([id]);await vi.advanceTimersByTimeAsync(61000);await service.lookup([id]);expect(fetcher).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(60000);expect((await service.lookup([id])).get(id)?.author).toBe("Photo courtesy of Alex");
});
