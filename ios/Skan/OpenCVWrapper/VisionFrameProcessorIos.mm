#import <Foundation/Foundation.h>
#import <CoreVideo/CoreVideo.h>
#import <React/RCTBridge+Private.h>
#import <React/RCTBridgeModule.h>
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>
#import <VisionCamera/Frame.h>

#include "EdgeDetector.hpp"
#include "SkanOpenCvJsiModule.hpp"
#include <atomic>
#include <jsi/jsi.h>

@interface RCT_EXTERN_MODULE(OcrProcessorModule, NSObject)
RCT_EXTERN_METHOD(recognizeFile:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end

@interface RCT_EXTERN_MODULE(PdfGeneratorModule, NSObject)
RCT_EXTERN_METHOD(generateSearchablePdf:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
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
    RCTCxxBridge* cxxBridge = (RCTCxxBridge*)self.bridge;
    if (!cxxBridge || !cxxBridge.runtime) {
        return @NO;
    }
    auto* jsiRuntime = static_cast<facebook::jsi::Runtime*>(cxxBridge.runtime);
    skan::SkanOpenCvJsiModule::install(*jsiRuntime);
    return @YES;
}

RCT_EXPORT_METHOD(consumeSharedImages:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@[]);
}

@end

namespace {
std::atomic<bool> gIosFrameProcessing{false};
}

@interface SkanVisionFrameProcessorIos : FrameProcessorPlugin
@end

@implementation SkanVisionFrameProcessorIos

- (instancetype)initWithProxy:(VisionCameraProxyHolder*)proxy
                  withOptions:(NSDictionary* _Nullable)options {
    self = [super initWithProxy:proxy withOptions:options];
    return self;
}

- (id _Nullable)callback:(Frame* _Nonnull)frame
           withArguments:(NSDictionary* _Nullable)arguments {
    bool expected = false;
    if (!gIosFrameProcessing.compare_exchange_strong(expected, true, std::memory_order_acquire)) {
        return @{@"skipped": @YES};
    }

    CMSampleBufferRef sampleBuffer = frame.buffer;
    CVImageBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
    if (!pixelBuffer) {
        gIosFrameProcessing.store(false, std::memory_order_release);
        return @{@"skipped": @YES};
    }

    CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

    const uint8_t* yPlaneAddress = static_cast<const uint8_t*>(
        CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0)
    );
    const int width = static_cast<int>(CVPixelBufferGetWidthOfPlane(pixelBuffer, 0));
    const int height = static_cast<int>(CVPixelBufferGetHeightOfPlane(pixelBuffer, 0));
    const int bytesPerRow = static_cast<int>(CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0));

    skan::EdgeDetectionResult result{};
    if (yPlaneAddress && width > 0 && height > 0) {
        result = skan::EdgeDetector::detectFromYPlane(
            yPlaneAddress,
            width,
            height,
            bytesPerRow
        );
    }

    CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
    gIosFrameProcessing.store(false, std::memory_order_release);

    return @{
        @"skipped": @NO,
        @"detected": @(result.detected),
        @"tlX": @(result.corners.topLeft.x),
        @"tlY": @(result.corners.topLeft.y),
        @"trX": @(result.corners.topRight.x),
        @"trY": @(result.corners.topRight.y),
        @"brX": @(result.corners.bottomRight.x),
        @"brY": @(result.corners.bottomRight.y),
        @"blX": @(result.corners.bottomLeft.x),
        @"blY": @(result.corners.bottomLeft.y),
        @"confidence": @(result.confidence),
        @"areaRatio": @(result.areaRatio),
        @"frameWidth": @(result.frameWidth),
        @"frameHeight": @(result.frameHeight)
    };
}

VISION_EXPORT_FRAME_PROCESSOR(SkanVisionFrameProcessorIos, detectDocumentEdges)

@end

