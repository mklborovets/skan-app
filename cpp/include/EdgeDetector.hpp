#pragma once

#include "PointSorter.hpp"
#include <cstdint>
#include <string>

namespace skan {

struct EdgeDetectionConfig {
    int targetAnalysisWidth = 480;
    double claheClipLimit = 2.5;
    int claheTileGridSize = 8;
    int morphKernelSize = 7;
    int gaussianBlurSize = 5;
    double cannySigma = 0.33;
    float minQuadAreaRatio = 0.15f;
    float maxQuadAreaRatio = 0.98f;
};

struct EdgeDetectionResult {
    bool detected = false;
    QuadCorners corners{};
    float confidence = 0.0f;
    float areaRatio = 0.0f;
    int frameWidth = 0;
    int frameHeight = 0;
};

class EdgeDetector {
public:
    static EdgeDetectionResult detectFromYPlane(
        const uint8_t* yPlaneData,
        int width,
        int height,
        int rowStride,
        const EdgeDetectionConfig& config = EdgeDetectionConfig{}
    );

    static EdgeDetectionResult detectFromImageFile(
        const std::string& filePath,
        const EdgeDetectionConfig& config = EdgeDetectionConfig{}
    );

    static uint8_t computeMedianIntensity(
        const uint8_t* grayscaleData,
        int width,
        int height,
        int rowStride
    );
};

}

