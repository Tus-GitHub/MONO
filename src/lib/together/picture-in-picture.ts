export type PipVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};
export function supportsCallPip(video: PipVideo | null) {
  if (!video || video.readyState < 1 || !video.videoWidth) return false;
  return Boolean((document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function")
    || (video.webkitSupportsPresentationMode?.("picture-in-picture") && video.webkitSetPresentationMode));
}
export async function enterCallPip(video: PipVideo) {
  if (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function") await video.requestPictureInPicture();
  else if (video.webkitSupportsPresentationMode?.("picture-in-picture") && video.webkitSetPresentationMode) video.webkitSetPresentationMode("picture-in-picture");
  else throw new Error("Your browser does not offer floating video outside MONO. The in-app mini view still works.");
}
export async function leaveCallPip(video: PipVideo) {
  if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
  else if (video.webkitPresentationMode === "picture-in-picture") video.webkitSetPresentationMode?.("inline");
}
