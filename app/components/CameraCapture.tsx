"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Check, RefreshCw, Upload, ArrowLeft, ShieldCheck, Info } from "lucide-react";
import { faceCrop, pixelHints, type FaceBox } from "../../src/client/photo-quality";

type Detector = { detect(source: HTMLCanvasElement): { detections: { boundingBox?: FaceBox }[] }; close(): void };
type Quality = { message: string; face: boolean; light: boolean; sharp: boolean; box?: FaceBox };
const INITIAL: Quality = { message: "Use your camera or upload a photo. Framing tips are optional.", face: false, light: false, sharp: false };
const VISION_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

function frame(source: HTMLVideoElement | HTMLImageElement, longest = 640, box?: FaceBox) {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!width || !height) throw new Error("The camera is still starting. Try again in a moment.");
  const crop = faceCrop(width, height, box), scale = Math.min(1, longest / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale)); canvas.height = Math.max(1, Math.round(crop.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Your browser could not prepare this photo. Try another browser.");
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}
function inspect(canvas: HTMLCanvasElement, detector: Detector | null): Quality {
  if (!detector) return { ...INITIAL, message: "You can continue. The AI will assess the detail available in your photo." };
  try {
    const faces = detector.detect(canvas).detections;
    if (faces.length !== 1 || !faces[0].boundingBox) return { ...INITIAL, message: faces.length > 1 ? "More than one face detected. A photo of just you works best; you can still continue." : "The framing guide can’t locate a face. You can still use this photo." };
    const box = faces[0].boundingBox, w = canvas.width, h = canvas.height;
    const x = Math.max(0, Math.floor(box.originX)), y = Math.max(0, Math.floor(box.originY));
    const rw = Math.max(0, Math.min(w - x, Math.floor(box.width))), rh = Math.max(0, Math.min(h - y, Math.floor(box.height)));
    if (rw < 3 || rh < 3) return INITIAL;
    const hints = pixelHints(canvas.getContext("2d", { willReadFrequently: true })!.getImageData(x, y, rw, rh).data, rw, rh);
    return { ...hints, face: true, box: { originX: box.originX / w, originY: box.originY / h, width: box.width / w, height: box.height / h }, message: !hints.light ? "Light is limited. You can continue; some observations may be uncertain." : !hints.sharp ? "A little soft focus. You can continue; only readable detail will be assessed." : "Face found. Use this photo whenever you’re ready." };
  } catch { return { ...INITIAL, message: "The framing guide is unavailable. Photo analysis still works." }; }
}
function prepare(source: HTMLVideoElement | HTMLImageElement, detector: Detector | null) {
  const quality = inspect(frame(source), detector);
  const canvas = frame(source, 1280, quality.box);
  let data = "";
  for (const compression of [.9, .82, .72]) { data = canvas.toDataURL("image/jpeg", compression); if (data.length < 2_100_000) break; }
  if (data.length >= 2_100_000) throw new Error("This image is too large to prepare. Choose a smaller photo.");
  return { data, quality };
}

export default function CameraCapture({ onCapture, onBack }: { onCapture(dataUrl: string): void; onBack(): void }) {
  const videoRef = useRef<HTMLVideoElement>(null), inputRef = useRef<HTMLInputElement>(null);
  const detectorRef = useRef<Detector | null>(null), streamRef = useRef<MediaStream | null>(null);
  const [quality, setQuality] = useState<Quality>(INITIAL), [error, setError] = useState("");
  const [cameraError, setCameraError] = useState(""), [cameraReady, setCameraReady] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null), [uploading, setUploading] = useState(false), [retry, setRetry] = useState(0);
  const photoRef = useRef<string | null>(null), generation = useRef(0);
  photoRef.current = photo;
  const stopCamera = () => { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; };
  useEffect(() => {
    const token = ++generation.current;
    let active = true, detector: Detector | null = null;
    setCameraError(""); setCameraReady(false); setQuality(INITIAL); setUploading(false);
    // The guide loads independently. Neither CDN/WASM failures nor denied camera access block uploads.
    void (async () => {
      try {
        const moduleUrl = `${VISION_ROOT}/vision_bundle.mjs`;
        const { FilesetResolver, FaceDetector } = await import(/* @vite-ignore */ moduleUrl);
        const files = await FilesetResolver.forVisionTasks(`${VISION_ROOT}/wasm`);
        detector = await FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: "CPU" }, runningMode: "IMAGE", minDetectionConfidence: .5 });
        if (!active || generation.current !== token) { detector?.close(); return; }
        detectorRef.current = detector;
      } catch { if (active && !photoRef.current) setQuality({ ...INITIAL, message: "Optional framing guide unavailable. You can still take or upload a photo." }); }
    })();
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Error();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1600 } } });
        if (!active || photoRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) { stopCamera(); return; }
        video.srcObject = stream; await video.play();
        if (active && !photoRef.current) setCameraReady(true);
      } catch {
        if (active && !photoRef.current) {
          setCameraError("Camera unavailable or blocked. Upload a photo below, or retry your camera.");
          fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "camera_denied" }) }).catch(() => {});
        }
      }
    })();
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!active || photoRef.current || !video?.videoWidth || !detectorRef.current) return;
      try { setQuality(inspect(frame(video), detectorRef.current)); } catch { /* A guide failure never disables capture. */ }
    }, 900);
    return () => { active = false; ++generation.current; clearInterval(timer); stopCamera(); detector?.close(); detectorRef.current = null; };
  }, [retry]);
  function selectPhoto(result: ReturnType<typeof prepare>) {
    photoRef.current = result.data; setPhoto(result.data); setQuality(result.quality); setError(""); stopCamera(); setCameraReady(false);
  }
  function capture() {
    if (!cameraReady || !videoRef.current || uploading) return;
    try { selectPhoto(prepare(videoRef.current, detectorRef.current)); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not capture this frame. Try again or upload a photo."); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if ((!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name)) || file.size > 20 * 1024 * 1024) { setError("Choose an image smaller than 20 MB."); return; }
    const token = generation.current;
    setUploading(true); setError("");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (generation.current !== token) return;
      selectPhoto(prepare(image, detectorRef.current));
    } catch (err) { if (generation.current === token) setError(err instanceof Error && err.message.includes("large") ? err.message : "This browser could not open the file. Try JPEG, PNG or WebP; some browsers cannot open HEIC."); }
    finally { URL.revokeObjectURL(url); if (generation.current === token) setUploading(false); }
  }
  return <section className="camera-capture">
    <button type="button" className="button text camera-back" onClick={onBack}><ArrowLeft size={16} />Back</button>
    <p className="eyebrow">{photo ? "YOUR PHOTO IS READY" : "REAL CAMERAS. REAL LIFE."}</p>
    <h2>{photo ? "Work with what you have." : "Your camera is enough."}</h2>
    <p>{photo ? "We’ll assess what’s visible and mark what isn’t. Soft focus or dim light won’t send you back to start." : "Take a selfie or upload one. Better light helps, but you don’t need a studio-quality photo."}</p>
    <div className={`camera-frame ${quality.face ? "camera-frame-ready" : ""}`}>
      <video ref={videoRef} autoPlay muted playsInline aria-label="Mirrored front camera preview" style={{ display: photo ? "none" : "block" }} />
      {photo ? <img src={photo} alt="Your selected photo, ready for analysis" /> : <>
        <div className="camera-oval" aria-hidden="true" />
        {!cameraReady && <div className="camera-placeholder"><Camera size={32} /><span>{cameraError ? "Upload your photo to continue." : "Starting camera. You can also upload below."}</span></div>}
      </>}
    </div>
    <div className="camera-advisory" role="status"><Info size={17} /><p>{photo ? quality.box ? "Framed around your face. No beauty filters or invented detail added." : "Your photo is ready. Areas that can’t be read will be marked clearly." : quality.message}</p></div>
    {!photo && <p className="fine-print camera-hint">Framing, light and focus tips are suggestions. You can continue without passing them.</p>}
    {(error || (!photo && cameraError)) && <p className="camera-error" role="alert">{error || cameraError}</p>}
    <div className="camera-actions">
      {photo ? <>
        <button type="button" className="button" onClick={() => { if (!photo) return; stopCamera(); fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "capture_ok" }) }).catch(() => {}); onCapture(photo); }}><Check size={18} />Analyse this photo</button>
        <button type="button" className="button secondary" onClick={() => { photoRef.current = null; setPhoto(null); setError(""); setRetry(value => value + 1); }}><RefreshCw size={16} />Choose another photo</button>
      </> : <>
        <button type="button" className="button" disabled={!cameraReady || uploading} onClick={capture}><Camera size={18} />Take photo</button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={upload} style={{display:"none"}} aria-label="Upload a photo" />
        <button type="button" className="button secondary" disabled={uploading} onClick={() => inputRef.current?.click()}><Upload size={16} />{uploading ? "Preparing photo…" : "Upload a photo"}</button>
        {cameraError && <button type="button" className="button text" onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} />Retry camera</button>}
      </>}
    </div>
    <p className="camera-privacy"><ShieldCheck size={16} /><span>Preparation stays on this device. Only “Analyse this photo” sends the selected image for analysis. Missing detail is marked as unreadable, never filled in.</span></p>
  </section>;
}
