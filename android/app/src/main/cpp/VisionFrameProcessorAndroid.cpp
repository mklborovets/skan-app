#if __has_include("EdgeDetector.hpp")
#include "EdgeDetector.hpp"
#include "PointSorter.hpp"
#include "SkanOpenCvJsiModule.hpp"
#else
#include "../../../../../cpp/include/EdgeDetector.hpp"
#include "../../../../../cpp/include/PointSorter.hpp"
#include "../../../../../cpp/jsi/SkanOpenCvJsiModule.hpp"
#endif

#include <atomic>
#include <cstdint>
#if __has_include(<jsi/jsi.h>)
#include <jsi/jsi.h>
#endif

#if __has_include(<jni.h>)
#include <jni.h>
#else
#define JNIEXPORT
#define JNICALL
using jint = int32_t;
using jlong = int64_t;
using jfloat = float;
using jobject = void*;
using jfloatArray = float*;
struct JNIEnv {
    void* GetDirectBufferAddress(jobject buf) { return buf; }
    jfloatArray NewFloatArray(int) { return nullptr; }
    void SetFloatArrayRegion(jfloatArray, int, int, const jfloat*) {}
};
#endif

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

extern "C" JNIEXPORT void JNICALL
Java_com_skan_frameprocessor_SkanEdgeFrameProcessorPlugin_nativeInstallJsiStatic(
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

