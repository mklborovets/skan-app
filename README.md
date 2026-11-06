# SKAN — On-Device Document Scanner (React Native CLI + OpenCV C++17 + JSI)

**SKAN** is a 100% offline, on-device mobile document scanner for Android and iOS built with **React Native CLI (New Architecture / JSI)**, **C++17 OpenCV 4.x**, **VisionCamera v4 Frame Processors**, **On-Device Google ML Kit OCR**, and **SQLite FTS5**.

All heavy computer vision workloads—30 FPS live sheet detection, perspective rectification, shadow removal, adaptive binarization, OCR text layer indexing, and multi-page searchable PDF generation—execute locally on the device without any cloud dependencies.

---

## Architecture & Engineering Constraints

The codebase strictly follows **Feature-Sliced Design (FSD)** with unidirectional layer imports:

```text
app -> pages -> widgets -> features -> entities -> shared
```

- **Shared C++17 Core (`cpp/`):** Platform-agnostic OpenCV algorithms (`PointSorter`, `EdgeDetector`, `PerspectiveWarper`, `ImageFilters`) bound to JavaScript via JSI (`SkanOpenCvJsiModule`) and native Frame Processor plugins (`VisionFrameProcessorAndroid.cpp` & `VisionFrameProcessorIos.mm`).
- **Zero Logic in UI (`ui/`):** All `.tsx` files inside `ui/` directories are purely declarative, contain zero `useEffect` hooks, and are capped at a maximum of **200 lines** enforced via ESLint.
- **Memory-Safe File Pipeline:** Images never cross the JS bridge as Base64 strings. All operations pass `file://` paths or zero-copy YUV plane pointers (`DirectByteBuffer` / `CVPixelBufferRef`).

---

## Computer Vision & Image Processing Parameters (Why These Values Were Chosen)

### 1. Real-Time 30 FPS Edge Detection (`cpp/src/EdgeDetector.cpp`)

| Parameter | Value | Engineering Rationale |
| :--- | :--- | :--- |
| **Input Color Channel** | `Y-Plane` (`YUV_420_888`) + `Lab`/`HSV` (Static) | Live frames extract Plane 0 (`Y` luminance) with zero RGB conversion overhead; static captures combine `Lab` Lightness (`L`), `b` chroma, and `HSV` Saturation (`S`) (`L - 0.6S - 0.8 max(0, b - 132)`) to suppress warm brown wooden tables and isolate paper sheets. |
| **Analysis Longest Edge (`targetAnalysisWidth`)** | `520 px` | Downsampling the longest dimension from 1080p/4K to 520px (`cv::INTER_AREA`) gives portrait and landscape frames identical spatial resolution while keeping sheet edges 3–5 px wide within a `<14 ms` frame budget. |
| **Texture Suppression (`medianBlur` + `GaussianBlur`)** | `5 × 5` median + `5 × 5` Gaussian | Suppresses ruled notebook lines, handwriting strokes, and wood-grain table textures without fusing paper boundaries to desk lines. |
| **Multi-Pass Segmentation** | `Otsu` + Adaptive Canny (`0.33` around median `M`) + `CLAHE (2.0)` | Evaluates Otsu binary masks (`MORPH_OPEN`/`MORPH_CLOSE` `5 × 5`), adaptive Canny passes around median intensity $M$, and a gentle `CLAHE` fallback (`clipLimit = 2.0`, `8 × 8`) for low-contrast white-on-white documents. |
| **Contour Solidity & Approximation (`approxPolyDP`)** | `0.015–0.05 × perimeter`, solidity `>= 0.72` (`>= 0.82` for hull) | Direct polygon approximation is prioritized over `convexHull`. Requiring high contour-to-quad solidity (`rawArea / quadArea >= 0.82` on hull candidates) rejects contours that leaked into wood grain or adjacent laptop edges. |
| **Composite Document Scoring (`scoreCandidateQuad`)** | `0.34 edge + 0.24 rect + 0.20 contrast + 0.12 solidity + 0.10 area` | Replaces naive largest-area selection with Sobel gradient verification along all 4 edges, inside-vs-outside boundary contrast, angle orthogonality, and frame-border touch penalties. |
| **Rotation-Invariant Corner Sorting (`PointSorter`)** | Directed edge alignment (`uTop.x + uRight.y - uBottom.x - uLeft.y`) | Orders clockwise vertices by matching unit edge vectors to upright axes rather than distance to `(0, 0)`, preventing 90° corner jumps when scanning tilted or landscape documents. |
| **Quad Area Ratio (`minQuadAreaRatio`, `maxQuadAreaRatio`)** | `0.08` – `0.95` | Rejects small background artifacts (`<8%` of frame area) and full-frame border false positives (`>95%`). |
| **Interior Angle Cosine (`maxAbsCosine`)** | `<= 0.82` (~35°–145°) | Filters out degenerate needle-like quadrilaterals caused by perspective glare on table edges. |

---

### 2. Temporal Stabilization & Auto-Capture (`SCAN_CONSTANTS`)

| Parameter | Value | Engineering Rationale |
| :--- | :--- | :--- |
| **EMA Smoothing (`EMA_SMOOTHING_ALPHA`)** | `0.35` | Exponential Moving Average $P_t = 0.35 P_{\text{raw}} + 0.65 P_{t-1}$ eliminates frame-to-frame corner jitter at 30 FPS while keeping visual lag under `50 ms` when the user moves the phone. |
| **Stability Window (`STABILITY_REQUIRED_FRAMES`)** | `35 frames` (~1.2 s) | Requiring 35 consecutive stable frames gives the camera hardware autofocus (`AF`) time to lock before triggering the full-resolution 12+ MP photo capture. |
| **Max Corner Drift (`STABILITY_MAX_DRIFT_RATIO`)** | `2.5%` of frame width | Allows natural hand micro-tremor while immediately resetting the countdown if the user intentionally repositions the device. |

---

### 3. Perspective Rectification & Shadow-Free Binarization (`cpp/src/ImageFilters.cpp`)

| Parameter | Value | Engineering Rationale |
| :--- | :--- | :--- |
| **Warp Interpolation** | `cv::INTER_CUBIC` | Bicubic interpolation preserves sharp serif edges on small 8pt–10pt typography during perspective rectification (`cv::warpPerspective`), significantly improving downstream ML Kit OCR accuracy. |
| **Shadow Estimation (`dilate` + `medianBlur`)** | `7 × 7` dilate + `31 × 31` median blur | Dilating with a `7 × 7` structuring element followed by a large median blur erases foreground text strokes, leaving a pure low-frequency map of the illumination and hand/phone shadow. Dividing the grayscale image by this background (`cv::divide`) flattens uneven lighting completely. |
| **Adaptive Threshold (`blockSize`, `C`)** | `blockSize = 21`, `C = 10` (`ADAPTIVE_THRESH_GAUSSIAN_C`) | A `21 × 21` Gaussian neighborhood spans roughly 1.5× the stroke width of standard body text at 12 MP resolution, while subtracting constant `C = 10` keeps paper backgrounds pure `#FFFFFF` without eating into thin character strokes. |

---

### 4. Memory-Safe Multi-Page PDF Generation (`PdfGeneratorModule`)

| Parameter | Value | Engineering Rationale |
| :--- | :--- | :--- |
| **Page Dimensions** | A4 (`595 × 842 pt` / `2480 × 3508 px` @ 300 DPI) | Standardizes output to physical ISO A4 print geometry regardless of camera sensor aspect ratio (`aspectFit` scaling). |
| **JPEG Compression (`PDF_JPEG_QUALITY`)** | `85` | Keeps a 25-page document under ~4–6 MB while preventing mosquito noise around high-contrast binarized text. |
| **Single-Page Streaming & Recycling** | `Bitmap.recycle()` / `autoreleasepool` per iteration | A single 12 MP `ARGB_8888` bitmap consumes ~48 MB of native heap. Decoding one file per page iteration, drawing the image and transparent OCR text layer, finishing the page, and immediately calling `recycle()` keeps native memory flat (`O(1)` with respect to page count), preventing `OutOfMemoryError` on 30+ page scans. |

---

## Development & Verification Commands

```bash
# Install dependencies
yarn install

# Run strict TypeScript verification
yarn typecheck

# Run ESLint (FSD boundaries + 200-line UI component cap)
yarn lint

# Run Android / iOS builds
yarn android
yarn ios
```

