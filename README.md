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
| **Input Color Channel** | `Y-Plane` only (`YUV_420_888`) | Extracting Plane 0 (`Y` luminance) directly from the camera buffer provides an instant 1-channel grayscale `cv::Mat` with zero RGB conversion overhead, saving ~4.5 ms per frame. |
| **Analysis Width (`DETECTION_TARGET_WIDTH`)** | `480 px` | Downsampling from 1080p/4K to 480px width (`cv::INTER_AREA`) reduces pixel count by ~80% while keeping sheet edges 3–5 px wide—ideal for `Canny` and `findContours` within a `<14 ms` frame budget. |
| **CLAHE (`clipLimit`, `tileGridSize`)** | `2.5`, `8 × 8` | Local histogram equalization boosts contrast along shadowed paper borders on unevenly lit desks without over-amplifying sensor noise in flat regions (`clipLimit > 3.5` introduces grain edges). |
| **Morphological Closing (`morphKernelSize`)** | `7 × 7` (`MORPH_CLOSE`) | Merges fine printed text characters inside the document and suppresses wood-grain table textures so internal paragraphs are not mistaken for document boundaries. |
| **Gaussian Blur (`gaussianBlurSize`)** | `5 × 5` | Smooths high-frequency artifacts remaining after morphological closing before computing Sobel gradients in Canny. |
| **Adaptive Canny (`cannySigma`)** | `0.33` around median `M` | Fixed Canny thresholds fail when moving between bright daylight and dim indoor lighting. Computing the image's median intensity $M$ and setting $T_{\text{low}} = \max(18, 0.67M)$ and $T_{\text{high}} = \min(240, 1.33M)$ adapts automatically to ambient exposure. |
| **Polygon Approximation (`approxPolyDP`)** | `0.02 × perimeter` | A 2% arc-length tolerance absorbs minor edge jaggedness and slightly bent corners while reliably collapsing the contour to 4 vertices (`convexHull` fallback with `0.025 × perimeter` handles partially occluded corners). |
| **Quad Area Ratio (`minQuadAreaRatio`, `maxQuadAreaRatio`)** | `0.15` – `0.98` | Rejects small background objects/post-it notes (`<15%` of frame area) and full-frame border false positives (`>98%`). |
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
