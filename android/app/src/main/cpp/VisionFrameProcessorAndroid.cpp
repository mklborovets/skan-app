#include "EdgeDetector.hpp"
#include "SkanOpenCvJsiModule.hpp"

#include <atomic>
#include <cstdint>
#include <jni.h>
#include <jsi/jsi.h>

namespace {

std::atomic<bool> gIsFrameProcessing{false};

struct ScopedProcessingGuard {
    bool acquired = false;

    ScopedProcessingGuard() {
        bool expected = false;
        acquired = gIsFrameProcessing.compare_exchange_strong(
            expected,
            true,
            std::memory_order_acquire
        );
    }

    ~ScopedProcessingGuard() {
        if (acquired) {
            gIsFrameProcessing.store(false, std::memory_order_release);
        }
    }
};

}

extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_skan_frameprocessor_SkanEdgeFrameProcessorPlugin_nativeDetectEdgesFromYPlane(
    JNIEnv* env,
    jobject,
    jobject yByteBuffer,
    jint width,
    jint height,
    jint rowStride
) {
    ScopedProcessingGuard guard;
    if (!guard.acquired || !yByteBuffer) {
        return nullptr;
    }

    auto* rawYPlane = static_cast<uint8_t*>(env->GetDirectBufferAddress(yByteBuffer));
    if (!rawYPlane) {
        return nullptr;
    }

    const skan::EdgeDetectionResult detection = skan::EdgeDetector::detectFromYPlane(
        rawYPlane,
        static_cast<int>(width),
        static_cast<int>(height),
        static_cast<int>(rowStride)
    );

    jfloat payload[13] = {
        detection.detected ? 1.0f : 0.0f,
        detection.corners.topLeft.x,
        detection.corners.topLeft.y,
        detection.corners.topRight.x,
        detection.corners.topRight.y,
        detection.corners.bottomRight.x,
        detection.corners.bottomRight.y,
        detection.corners.bottomLeft.x,
        detection.corners.bottomLeft.y,
        detection.confidence,
        detection.areaRatio,
        static_cast<float>(detection.frameWidth),
        static_cast<float>(detection.frameHeight)
    };

    jfloatArray outputArray = env->NewFloatArray(13);
    if (!outputArray) {
        return nullptr;
    }
    env->SetFloatArrayRegion(outputArray, 0, 13, payload);
    return outputArray;
}

extern "C" JNIEXPORT void JNICALL
Java_com_skan_frameprocessor_SkanEdgeFrameProcessorPlugin_nativeInstallJsi(
    JNIEnv*,
    jobject,
    jlong jsiRuntimePtr
) {
    if (jsiRuntimePtr == 0) {
        return;
    }
    auto* runtime = reinterpret_cast<facebook::jsi::Runtime*>(jsiRuntimePtr);
    skan::SkanOpenCvJsiModule::install(*runtime);
}
