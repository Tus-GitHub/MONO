/** Abortable XHR keeps upload progress while giving every terminal path one settlement. */
export function uploadImageRequest<T>(endpoint: string, file: File, signal: AbortSignal, onProgress: (progress: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Upload cancelled.")); return; }
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (error: Error | null, data?: T) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(data as T);
    };
    const abort = () => { xhr.abort(); finish(new Error("Upload cancelled.")); };
    signal.addEventListener("abort", abort, { once: true });
    xhr.open("POST", endpoint);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => {
      if (!signal.aborted && event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 413) { finish(new Error("That image is too large to upload. Choose a smaller image.")); return; }
      let data: T & { error?: string };
      try { data = JSON.parse(xhr.responseText); }
      catch { finish(new Error(xhr.status >= 200 && xhr.status < 300 ? "Upload succeeded but the response was unreadable." : "Upload failed. Try again.")); return; }
      if (xhr.status < 200 || xhr.status >= 300) finish(new Error(data?.error ?? "Upload failed. Try again."));
      else finish(null, data);
    };
    xhr.onerror = () => finish(new Error("Network error during upload."));
    xhr.ontimeout = () => finish(new Error("Upload timed out. Try again."));
    xhr.onabort = () => finish(new Error("Upload cancelled."));
    const body = new FormData(); body.append("file", file);
    try { xhr.send(body); } catch { finish(new Error("Upload failed. Try again.")); }
  });
}
