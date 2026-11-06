#if __has_include("EdgeDetector.hpp")
#include "EdgeDetector.hpp"
#include "PointSorter.hpp"
#include "SkanOpenCvJsiModule.hpp"
#else
#include "../../../cpp/include/EdgeDetector.hpp"
#include "../../../cpp/include/PointSorter.hpp"
#include "../../../cpp/jsi/SkanOpenCvJsiModule.hpp"
#endif
#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#if __has_include(<jsi/jsi.h>)
#include <jsi/jsi.h>
#endif

#if defined(__OBJC__)
#import <CoreGraphics/CoreGraphics.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <Vision/Vision.h>
#endif

namespace skan {

bool tryAcquireIosFrameLock(std::atomic<bool> &flag) {
  bool expected = false;
  return flag.compare_exchange_strong(expected, true,
                                      std::memory_order_acquire);
}

void releaseIosFrameLock(std::atomic<bool> &flag) {
  flag.store(false, std::memory_order_release);
}

#if defined(__OBJC__)
namespace {

float clampFloat(float val, float lo, float hi) {
  return std::max(lo, std::min(hi, val));
}

bool isTransposedExifOrientation(CGImagePropertyOrientation orientation) {
  switch (orientation) {
  case kCGImagePropertyOrientationLeftMirrored:
  case kCGImagePropertyOrientationRight:
  case kCGImagePropertyOrientationRightMirrored:
  case kCGImagePropertyOrientationLeft:
    return true;
  default:
    return false;
  }
}

EdgeDetectionResult
extractResultFromRectangleObservation(VNRectangleObservation *observation,
                                      int targetWidth, int targetHeight) {
  EdgeDetectionResult out{};
  out.frameWidth = targetWidth;
  out.frameHeight = targetHeight;

  if (!observation || targetWidth <= 0 || targetHeight <= 0) {
    return out;
  }

  const float w = static_cast<float>(targetWidth);
  const float h = static_cast<float>(targetHeight);

  const std::array<Point2f, 4> rawPts = {
      {Point2f{static_cast<float>(observation.topLeft.x) * w,
               static_cast<float>(1.0 - observation.topLeft.y) * h},
       Point2f{static_cast<float>(observation.topRight.x) * w,
               static_cast<float>(1.0 - observation.topRight.y) * h},
       Point2f{static_cast<float>(observation.bottomRight.x) * w,
               static_cast<float>(1.0 - observation.bottomRight.y) * h},
       Point2f{static_cast<float>(observation.bottomLeft.x) * w,
               static_cast<float>(1.0 - observation.bottomLeft.y) * h}}};

  const QuadCorners sorted = PointSorter::sortPoints(rawPts);
  if (!PointSorter::isValidDocumentQuad(sorted, targetWidth, targetHeight,
                                        0.05f, 0.96f)) {
    return out;
  }

  const float frameArea = std::max(1.0f, w * h);
  const float quadArea = PointSorter::computeQuadArea(sorted);
  out.detected = true;
  out.corners = sorted;
  out.areaRatio = quadArea / frameArea;
  out.confidence =
      clampFloat(static_cast<float>(observation.confidence), 0.4f, 1.0f);
  return out;
}

EdgeDetectionResult runVisionRequestsWithHandler(VNImageRequestHandler *handler,
                                                 int orientedWidth,
                                                 int orientedHeight) {
  EdgeDetectionResult result{};
  result.frameWidth = orientedWidth;
  result.frameHeight = orientedHeight;

  if (!handler || orientedWidth <= 0 || orientedHeight <= 0) {
    return result;
  }

  // 1. Primary: Apple neural document segmentation (iOS 15+ / macOS 12+)
  if (@available(iOS 15.0, macOS 12.0, *)) {
    VNDetectDocumentSegmentationRequest *docRequest =
        [[VNDetectDocumentSegmentationRequest alloc] init];
    NSError *docError = nil;
    if ([handler performRequests:@[ docRequest ] error:&docError] &&
        !docError) {
      VNRectangleObservation *obs = docRequest.results.firstObject;
      if (obs && obs.confidence >= 0.45f) {
        EdgeDetectionResult segResult = extractResultFromRectangleObservation(
            obs, orientedWidth, orientedHeight);
        if (segResult.detected) {
          return segResult;
        }
      }
    }
  }

  // 2. Secondary: VNDetectRectanglesRequest with multi-candidate scoring
  VNDetectRectanglesRequest *rectRequest =
      [[VNDetectRectanglesRequest alloc] init];
  rectRequest.minimumAspectRatio = 0.2f;
  rectRequest.maximumAspectRatio = 1.0f;
  rectRequest.minimumSize = 0.10f;
  rectRequest.quadratureTolerance = 35.0f;
  rectRequest.minimumConfidence = 0.50f;
  rectRequest.maximumObservations = 6;

  NSError *rectError = nil;
  if ([handler performRequests:@[ rectRequest ] error:&rectError] &&
      !rectError) {
    float bestScore = -1.0f;
    EdgeDetectionResult bestCandidate{};
    bestCandidate.frameWidth = orientedWidth;
    bestCandidate.frameHeight = orientedHeight;

    for (VNRectangleObservation *obs in rectRequest.results) {
      EdgeDetectionResult candidate = extractResultFromRectangleObservation(
          obs, orientedWidth, orientedHeight);
      if (!candidate.detected) {
        continue;
      }
      const float score = candidate.confidence *
                          std::sqrt(std::min(1.0f, candidate.areaRatio / 0.5f));
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate.detected) {
      return bestCandidate;
    }
  }

  return result;
}

} // namespace

EdgeDetectionResult detectIosVisionFromImageFile(const std::string &filePath) {
  EdgeDetectionResult empty{};
  if (filePath.empty()) {
    return empty;
  }

  @autoreleasepool {
    NSString *rawPath = [NSString stringWithUTF8String:filePath.c_str()];
    if (!rawPath || rawPath.length == 0) {
      return empty;
    }

    NSString *cleanPath = [rawPath
        stringByTrimmingCharactersInSet:[NSCharacterSet
                                            whitespaceAndNewlineCharacterSet]];
    if ([cleanPath hasPrefix:@"file://"]) {
      NSURL *fileUrl = [NSURL URLWithString:cleanPath];
      if (fileUrl && fileUrl.isFileURL && fileUrl.path) {
        cleanPath = fileUrl.path;
      } else {
        cleanPath = [cleanPath substringFromIndex:7];
      }
    }

    NSURL *imageUrl = [NSURL fileURLWithPath:cleanPath];
    if (!imageUrl) {
      return empty;
    }

    CGImageSourceRef imageSource =
        CGImageSourceCreateWithURL((__bridge CFURLRef)imageUrl, NULL);
    if (!imageSource) {
      return empty;
    }

    CGImagePropertyOrientation cgOrientation = kCGImagePropertyOrientationUp;
    CFDictionaryRef properties =
        CGImageSourceCopyPropertiesAtIndex(imageSource, 0, NULL);
    if (properties) {
      CFNumberRef orientationNum = (CFNumberRef)CFDictionaryGetValue(
          properties, kCGImagePropertyOrientation);
      if (orientationNum) {
        int rawOrient = static_cast<int>(kCGImagePropertyOrientationUp);
        if (CFNumberGetValue(orientationNum, kCFNumberIntType, &rawOrient) &&
            rawOrient >= 1 && rawOrient <= 8) {
          cgOrientation = static_cast<CGImagePropertyOrientation>(rawOrient);
        }
      }
      CFRelease(properties);
    }

    CGImageRef cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, NULL);
    CFRelease(imageSource);
    if (!cgImage) {
      return empty;
    }

    const int rawPixelW = static_cast<int>(CGImageGetWidth(cgImage));
    const int rawPixelH = static_cast<int>(CGImageGetHeight(cgImage));
    const bool transposed = isTransposedExifOrientation(cgOrientation);
    const int orientedWidth = std::max(1, transposed ? rawPixelH : rawPixelW);
    const int orientedHeight = std::max(1, transposed ? rawPixelW : rawPixelH);

    VNImageRequestHandler *handler =
        [[VNImageRequestHandler alloc] initWithCGImage:cgImage
                                           orientation:cgOrientation
                                               options:@{}];

    EdgeDetectionResult detected =
        runVisionRequestsWithHandler(handler, orientedWidth, orientedHeight);
    CGImageRelease(cgImage);
    return detected;
  }
}
#endif

EdgeDetectionResult runIosFrameEdgeDetection(const uint8_t *yPlaneAddress,
                                             int width, int height,
                                             int bytesPerRow) {
  if (!yPlaneAddress || width <= 0 || height <= 0) {
    return EdgeDetectionResult{};
  }
  return EdgeDetector::detectFromYPlane(yPlaneAddress, width, height,
                                        bytesPerRow);
}

void installIosOpenCvJsi(facebook::jsi::Runtime *runtime) {
  if (runtime) {
    SkanOpenCvJsiModule::install(*runtime);
  }
}

} // namespace skan

#if defined(__OBJC__)

#if __has_include(<React/RCTBridgeModule.h>)
#import <React/RCTBridge+Private.h>
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (OcrProcessorModule, NSObject)
RCT_EXTERN_METHOD(recognizeFile : (NSString *)filePath resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
@end

@interface RCT_EXTERN_MODULE (PdfGeneratorModule, NSObject)
RCT_EXTERN_METHOD(generateSearchablePdf : (NSDictionary *)options resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
@end

@interface BonusIntegrationsModule : NSObject <RCTBridgeModule>
@end

@implementation BonusIntegrationsModule

@synthesize bridge = _bridge;

RCT_EXPORT_MODULE(BonusIntegrationsModule)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(installOpenCvJsi) {
  RCTCxxBridge *cxxBridge = (RCTCxxBridge *)self.bridge;
  if (!cxxBridge || !cxxBridge.runtime) {
    return @NO;
  }
  skan::installIosOpenCvJsi(
      static_cast<facebook::jsi::Runtime *>(cxxBridge.runtime));
  return @YES;
}

RCT_EXPORT_METHOD(consumeSharedImages : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject) {
  resolve(@[]);
}

@end
#endif

#if __has_include(<VisionCamera/FrameProcessorPlugin.h>)
#import <VisionCamera/Frame.h>
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

namespace {
std::atomic<bool> gIosFrameProcessing{false};
}

@interface SkanVisionFrameProcessorIos : FrameProcessorPlugin
@end

@implementation SkanVisionFrameProcessorIos

- (instancetype)initWithProxy:(VisionCameraProxyHolder *)proxy
                  withOptions:(NSDictionary *_Nullable)options {
  self = [super initWithProxy:proxy withOptions:options];
  return self;
}

- (id _Nullable)callback:(Frame *_Nonnull)frame
           withArguments:(NSDictionary *_Nullable)arguments {
  bool expected = false;
  if (!gIosFrameProcessing.compare_exchange_strong(expected, true,
                                                   std::memory_order_acquire)) {
    return @{@"skipped" : @YES};
  }

  CMSampleBufferRef sampleBuffer = frame.buffer;
  CVImageBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
  if (!pixelBuffer) {
    gIosFrameProcessing.store(false, std::memory_order_release);
    return @{@"skipped" : @YES};
  }

  const int rawWidth =
      static_cast<int>(CVPixelBufferGetWidthOfPlane(pixelBuffer, 0));
  const int rawHeight =
      static_cast<int>(CVPixelBufferGetHeightOfPlane(pixelBuffer, 0));
  const NSInteger frameOrientRaw = static_cast<NSInteger>(frame.orientation);
  const bool isRightRotated = (frameOrientRaw == 3 || frameOrientRaw == 7);
  const bool isLeftRotated = (frameOrientRaw == 2 || frameOrientRaw == 6);
  const bool isDownRotated = (frameOrientRaw == 1 || frameOrientRaw == 5);
  const bool isLandscapeSensorBuffer =
      rawWidth > rawHeight && (isLeftRotated || isRightRotated);

  const int orientedWidth = isLandscapeSensorBuffer ? rawHeight : rawWidth;
  const int orientedHeight = isLandscapeSensorBuffer ? rawWidth : rawHeight;
  const CGImagePropertyOrientation visionOrientation =
      isLandscapeSensorBuffer
          ? (isRightRotated ? kCGImagePropertyOrientationLeft
                            : kCGImagePropertyOrientationRight)
          : (isDownRotated ? kCGImagePropertyOrientationDown
                           : kCGImagePropertyOrientationUp);

  skan::EdgeDetectionResult result{};

  @autoreleasepool {
    VNImageRequestHandler *handler =
        [[VNImageRequestHandler alloc] initWithCVPixelBuffer:pixelBuffer
                                                 orientation:visionOrientation
                                                     options:@{}];
    result = skan::runVisionRequestsWithHandler(handler, orientedWidth,
                                                orientedHeight);
  }

  if (!result.detected) {
    CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

    const uint8_t *yPlaneAddress = static_cast<const uint8_t *>(
        CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0));
    const int bytesPerRow =
        static_cast<int>(CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0));

    const skan::EdgeDetectionResult rawOpenCvResult =
        skan::runIosFrameEdgeDetection(yPlaneAddress, rawWidth, rawHeight,
                                       bytesPerRow);

    CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

    if (rawOpenCvResult.detected) {
      result = rawOpenCvResult;
      result.frameWidth = orientedWidth;
      result.frameHeight = orientedHeight;

      if (isLandscapeSensorBuffer) {
        const auto rotatePt = [&](const skan::Point2f &pt) -> skan::Point2f {
          if (isRightRotated) {
            return skan::Point2f{pt.y, static_cast<float>(rawWidth) - pt.x};
          }
          return skan::Point2f{static_cast<float>(rawHeight) - pt.y, pt.x};
        };
        const std::array<skan::Point2f, 4> rotatedPts = {
            {rotatePt(rawOpenCvResult.corners.topLeft),
             rotatePt(rawOpenCvResult.corners.topRight),
             rotatePt(rawOpenCvResult.corners.bottomRight),
             rotatePt(rawOpenCvResult.corners.bottomLeft)}};
        result.corners = skan::PointSorter::sortPoints(rotatedPts);
      }
    } else {
      result.frameWidth = orientedWidth;
      result.frameHeight = orientedHeight;
    }
  }

  gIosFrameProcessing.store(false, std::memory_order_release);

  return @{
    @"skipped" : @NO,
    @"detected" : @(result.detected),
    @"tlX" : @(result.corners.topLeft.x),
    @"tlY" : @(result.corners.topLeft.y),
    @"trX" : @(result.corners.topRight.x),
    @"trY" : @(result.corners.topRight.y),
    @"brX" : @(result.corners.bottomRight.x),
    @"brY" : @(result.corners.bottomRight.y),
    @"blX" : @(result.corners.bottomLeft.x),
    @"blY" : @(result.corners.bottomLeft.y),
    @"confidence" : @(result.confidence),
    @"areaRatio" : @(result.areaRatio),
    @"frameWidth" : @(result.frameWidth),
    @"frameHeight" : @(result.frameHeight)
  };
}

VISION_EXPORT_FRAME_PROCESSOR(SkanVisionFrameProcessorIos, detectDocumentEdges)

@end
#endif
#endif
