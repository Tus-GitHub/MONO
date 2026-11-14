# Adjusting saved photos

Use **Adjust crop** beside a saved profile or couple photo, on a date gallery photo or
inside its viewer, and beside a chat photo you sent. The existing editor supports pan,
zoom, reset and the existing photo shapes. **Save crop** saves immediately. Cancel and
browser Back leave the saved framing unchanged.

Adjustments are non-destructive: MONO saves normalized coordinates against the existing
stored source. There is no new image upload, storage object, date photo or chat message.
Reopening the editor uses that same source, so repeated edits do not progressively discard
pixels. Pixels already removed before the original upload are unavailable.

- Profile crops belong to the signed-in user. Either active partner can adjust the couple
  cover or shared date photos. Only a chat photo's sender can change its crop.
- Private media retains its authorization checks and crop-specific ETags. Date thumbnails,
  full images, covers, place history and Memories use the same normalized region.
- Chat images remain encrypted. The client decrypts the source locally and clips its
  display. Saving changes only crop metadata and message revision, preserving ciphertext,
  storage usage and view-once/twice limits. The recipient receives the updated revision.
- Stale editors receive a conflict instead of overwriting a replacement or newer crop.
- Replacing/removing a file clears its old crop. Archive exports/restores preserve date
  and couple framing while accepting older archives that lack the optional crop fields.

The additive `20261115160000_saved_photo_crops` migration introduces four nullable JSONB
fields; existing images render unchanged until adjusted. The `/api/photos/crop` descriptor
and PATCH endpoint resolve ownership server-side. PATCH requires same-origin JSON, bounded
coordinates and a source revision. Cropping is framing, not a privacy redaction: authorized
members still have access to the stored original.
