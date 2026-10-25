"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Camera,
  Check,
  RefreshCw,
  Upload,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

type Detection = {
  boundingBox?: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
};
type Detector = {
  detect(source: HTMLCanvasElement): { detections: Detection[] };
  close(): void;
};
type Quality = {
  ok: boolean;
  message: string;
  face: boolean;
  light: boolean;
  sharp: boolean;
};
const INITIAL: Quality = {
  ok: false,
  message: "Starting the on-device photo checks…",
  face: false,
  light: false,
  sharp: false,
};
const VISION_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

function frame(
  source: HTMLVideoElement | HTMLImageElement,
  crop: boolean,
  longest = 640,
): HTMLCanvasElement {
  const width =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source.naturalWidth;
  const height =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source.naturalHeight;
  if (!width || !height)
    throw new Error("The camera is still starting. Try again in a moment.");
  let sw = width,
    sh = height;
  if (crop) {
    if (width / height > 0.8) sw = height * 0.8;
    else sh = width / 0.8;
  }
  const scale = Math.min(1, longest / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context)
    throw new Error(
      "Your browser cannot prepare this photo. Try another browser.",
    );
  context.drawImage(
    source,
    (width - sw) / 2,
    (height - sh) / 2,
    sw,
    sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

function check(canvas: HTMLCanvasElement, detector: Detector): Quality {
  const faces = detector.detect(canvas).detections;
  const fail = (message: string, face = false, light = false): Quality => ({
    ok: false,
    message,
    face,
    light,
    sharp: false,
  });
  if (!faces.length) return fail("Bring your face into the oval.");
  if (faces.length !== 1) return fail("Just one face, please.");
  const box = faces[0].boundingBox;
  if (!box)
    return fail("We could not locate your face. Try facing the camera.");
  const { width: w, height: h } = canvas;
  if (box.width / w < 0.27 || box.height / h < 0.25)
    return fail("Move a little closer.");
  if (box.width / w > 0.83 || box.height / h > 0.84)
    return fail("Move back a little. Keep your whole face in view.");
  const centerX = (box.originX + box.width / 2) / w;
  const centerY = (box.originY + box.height / 2) / h;
  if (
    Math.abs(centerX - 0.5) > 0.16 ||
    Math.abs(centerY - 0.48) > 0.19 ||
    box.originX < 3 ||
    box.originY < 3 ||
    box.originX + box.width > w - 3 ||
    box.originY + box.height > h - 3
  )
    return fail("Centre your face and look straight ahead.");
  const x = Math.max(0, Math.floor(box.originX));
  const y = Math.max(0, Math.floor(box.originY));
  const rw = Math.min(w - x, Math.floor(box.width));
  const rh = Math.min(h - y, Math.floor(box.height));
  const pixels = canvas
    .getContext("2d", { willReadFrequently: true })!
    .getImageData(x, y, rw, rh).data;
  const gray = new Float32Array(rw * rh);
  let total = 0,
    clipped = 0;
  for (let i = 0; i < gray.length; i++) {
    const value =
      0.2126 * pixels[i * 4] +
      0.7152 * pixels[i * 4 + 1] +
      0.0722 * pixels[i * 4 + 2];
    gray[i] = value;
    total += value;
    if (value > 248) clipped++;
  }
  // Broad thresholds assess exposure, never skin tone; the photo model also checks image usability.
  if (total / gray.length < 40)
    return fail("Find more light. Face a window if you can.", true);
  if (total / gray.length > 235 || clipped / gray.length > 0.4)
    return fail("The light is too strong. Move out of direct sunlight.", true);
  let lapSum = 0,
    lapSquared = 0,
    count = 0;
  for (let iy = 1; iy < rh - 1; iy++)
    for (let ix = 1; ix < rw - 1; ix++) {
      const i = iy * rw + ix;
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - rw] - gray[i + rw];
      lapSum += lap;
      lapSquared += lap * lap;
      count++;
    }
  if (!count || lapSquared / count - (lapSum / count) ** 2 < 24)
    return fail("Hold still and let the camera focus.", true, true);
  return {
    ok: true,
    message: "Good light. Face in frame. Ready when you are.",
    face: true,
    light: true,
    sharp: true,
  };
}

export default function CameraCapture({
  onCapture,
  onBack,
}: {
  onCapture(dataUrl: string): void;
  onBack(): void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const detectorRef = useRef<Detector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [quality, setQuality] = useState<Quality>(INITIAL);
  const [error, setError] = useState("");
  const [modelReady, setModelReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [retry, setRetry] = useState(0);
  const photoRef = useRef<string | null>(null);
  photoRef.current = photo;

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    let detector: Detector | null = null;
    let checking = false;
    setError("");
    setQuality(INITIAL);
    setModelReady(false);
    setCameraReady(false);
    const initialise = async () => {
      try {
        const moduleUrl = `${VISION_ROOT}/vision_bundle.mjs`;
        const { FilesetResolver, FaceDetector } = await import(
          /* @vite-ignore */ moduleUrl
        );
        const files = await FilesetResolver.forVisionTasks(
          `${VISION_ROOT}/wasm`,
        );
        detector = await FaceDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.65,
        });
        if (!active) {
          detector?.close();
          return;
        }
        detectorRef.current = detector;
        setModelReady(true);
        setQuality({
          ...INITIAL,
          message: "Allow the camera, or upload a clear photo.",
        });
      } catch {
        if (active) {
          setError(
            "The on-device face checker could not load. Check your connection, then retry. You can also go back and use the quiz-only routine.",
          );
          setQuality({
            ...INITIAL,
            message: "Photo checks unavailable. No photo will be sent.",
          });
        }
        return;
      }
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw new Error("Camera needs HTTPS and a supported browser.");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1600 },
          },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        if (!active) return;
        setCameraReady(true);
        timer = setInterval(() => {
          if (
            !active ||
            checking ||
            photoRef.current ||
            !video.videoWidth ||
            !detector
          )
            return;
          checking = true;
          try {
            setQuality(check(frame(video, true), detector));
          } catch {
            setQuality({
              ...INITIAL,
              message:
                "Photo checks paused. Try retrying the camera or upload a photo.",
            });
          } finally {
            checking = false;
          }
        }, 650);
      } catch (err) {
        if (active) {
          const denied =
            err instanceof DOMException &&
            (err.name === "NotAllowedError" ||
              err.name === "PermissionDeniedError");
          setError(
            denied
              ? "Camera access is blocked. Allow camera access in your browser’s site settings, or upload a photo below."
              : "We could not open your front camera. Close other camera apps, retry, or upload a photo.",
          );
          setQuality({
            ...INITIAL,
            message: "Upload a clear, front-facing photo instead.",
          });
          fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "camera_denied" }),
          }).catch(() => {});
        }
      }
    };
    void initialise();
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      detector?.close();
      detectorRef.current = null;
    };
  }, [retry]);

  function capture() {
    if (!quality.ok || !videoRef.current || !detectorRef.current) return;
    try {
      // Re-check the actual frame at capture time; a stale green hint never authorises a bad frame.
      const canvas = frame(videoRef.current, true);
      const result = check(canvas, detectorRef.current);
      setQuality(result);
      if (!result.ok) return;
      const image = frame(videoRef.current, true, 1024).toDataURL(
        "image/jpeg",
        0.88,
      );
      setPhoto(image);
      setError("");
    } catch {
      setError(
        "We could not capture that frame. Hold still and try once more.",
      );
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      setError(
        "Choose a photo smaller than 20 MB in JPEG, PNG or WebP format.",
      );
      return;
    }
    if (!detectorRef.current) {
      setError(
        "The face checker is not ready. Retry it before uploading a photo.",
      );
      return;
    }
    setUploading(true);
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!detectorRef.current) return;
      const result = check(frame(image, false), detectorRef.current);
      setQuality(result);
      if (!result.ok) {
        setError(`${result.message} Try another photo.`);
        return;
      }
      setPhoto(frame(image, false, 1024).toDataURL("image/jpeg", 0.88));
    } catch {
      setError(
        "We could not read that image. Export it as JPEG or PNG and try again.",
      );
    } finally {
      URL.revokeObjectURL(url);
      setUploading(false);
    }
  }

  return (
    <section className="camera-capture">
      <button
        type="button"
        className="button text camera-back"
        onClick={onBack}
      >
        <ArrowLeft size={16} /> Back
      </button>
      <p className="eyebrow">
        {photo ? "ONE LAST LOOK" : "YOUR PHOTO, YOUR CHOICE"}
      </p>
      <h2>{photo ? "A clear starting point." : "Find your light."}</h2>
      <p>
        {photo
          ? "Check that your face is clear. This photo stays in memory until you choose to analyse it."
          : "Face a window. No filter or makeup. Hair back, whole face in view."}
      </p>
      <div
        className={`camera-frame ${quality.ok ? "camera-frame-ready" : ""}`}
        style={{
          position: "relative",
          aspectRatio: "4 / 5",
          maxWidth: 360,
          margin: "24px auto 16px",
          overflow: "hidden",
          background: "#12262B",
          borderRadius: 8,
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Mirrored front camera preview"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)",
            display: photo ? "none" : "block",
          }}
        />
        {photo ? (
          <img
            src={photo}
            alt="Your selected photo, ready for your review"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "19%",
                right: "19%",
                top: "17%",
                bottom: "19%",
                border: `2px dashed ${quality.ok ? "#A9D6BB" : "#FFFFFFAA"}`,
                borderRadius: "50%",
                boxShadow: "0 0 0 160px #12262B44",
              }}
            />
            {!cameraReady && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeContent: "center",
                  textAlign: "center",
                  gap: 12,
                  padding: 28,
                  color: "#E9F1EE",
                }}
              >
                <Camera size={32} style={{ margin: "auto" }} />
                <span>
                  {!modelReady
                    ? error
                      ? "Photo checks could not load."
                      : "Loading private photo checks…"
                    : "Allow your camera, or upload below."}
                </span>
              </div>
            )}
          </>
        )}
      </div>
      {!photo && (
        <>
          <p
            className="camera-hint"
            role="status"
            aria-live="polite"
            style={{ textAlign: "center", minHeight: 48 }}
          >
            {quality.message}
          </p>
          <div
            className="camera-checks"
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              fontSize: 12,
              marginBottom: 20,
            }}
          >
            {[
              ["Face", quality.face],
              ["Light", quality.light],
              ["Focus", quality.sharp],
            ].map(([name, passed]) => (
              <span
                key={String(name)}
                style={{
                  color: passed ? "#1F6B63" : "#46595D",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {passed ? (
                  <Check size={14} />
                ) : (
                  <span aria-hidden="true">○</span>
                )}
                {name}
              </span>
            ))}
          </div>
        </>
      )}
      {error && (
        <p
          className="camera-error"
          role="alert"
          style={{
            color: "#B23A48",
            background: "#FAEDEF",
            padding: 16,
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      )}
      <div
        className="camera-actions"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 360,
          margin: "20px auto",
        }}
      >
        {photo ? (
          <>
            <button
              type="button"
              className="button"
              onClick={() => {
                streamRef.current?.getTracks().forEach((track) => track.stop());
                fetch("/api/events", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: "capture_ok" }),
                }).catch(() => {});
                onCapture(photo);
              }}
            >
              <Check size={18} /> Use this photo
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setPhoto(null);
                setQuality(INITIAL);
                setError("");
              }}
            >
              <RefreshCw size={16} /> Retake
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="button"
              disabled={!quality.ok || !cameraReady || uploading}
              onClick={capture}
            >
              <Camera size={18} /> Take photo
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={upload}
              style={{ display: "none" }}
              aria-label="Upload a photo"
            />
            <button
              type="button"
              className="button secondary"
              onClick={() => inputRef.current?.click()}
              disabled={!modelReady || uploading}
            >
              <Upload size={16} />
              {uploading ? "Checking your photo…" : "Upload a photo"}
            </button>
            {error && (
              <button
                type="button"
                className="button text"
                onClick={() => setRetry((value) => value + 1)}
              >
                <RefreshCw size={16} /> Retry photo checks
              </button>
            )}
          </>
        )}
      </div>
      <p
        className="camera-privacy"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          fontSize: 12,
          lineHeight: 1.5,
          color: "#46595D",
        }}
      >
        <ShieldCheck size={16} style={{ flexShrink: 0 }} />
        <span>
          Face and quality checks run on this device using Google MediaPipe.
          These checks do not upload your photo. Analysis begins only when you
          choose “Use this photo”.
        </span>
      </p>
    </section>
  );
}
