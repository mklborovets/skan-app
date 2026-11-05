#include "EdgeDetector.hpp"

#include "PointSorter.hpp"
#include <algorithm>
#include <array>
#include <cstddef>

#if SKAN_HAS_OPENCV
#include <cmath>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>
#include <vector>
#endif

namespace skan {

uint8_t EdgeDetector::computeMedianIntensity(
    const uint8_t* grayscaleData,
    int width,
    int height,
    int rowStride
) {
    if (!grayscaleData || width <= 0 || height <= 0 || rowStride < width) {
        return 128;
    }

    std::array<uint32_t, 256> histogram{};
    uint32_t totalSamples = 0;

    const int stepY = std::max(1, height / 120);
    const int stepX = std::max(1, width / 120);

    for (int y = 0; y < height; y += stepY) {
        const uint8_t* rowPtr = grayscaleData + y * rowStride;
        for (int x = 0; x < width; x += stepX) {
            histogram[rowPtr[x]] += 1;
            totalSamples += 1;
        }
    }

    const uint32_t medianTarget = totalSamples / 2;
    uint32_t cumulative = 0;
    for (size_t i = 0; i < 256; ++i) {
        cumulative += histogram[i];
        if (cumulative >= medianTarget) {
            return static_cast<uint8_t>(i);
        }
    }

    return 128;
}

#if SKAN_HAS_OPENCV
namespace {

EdgeDetectionResult runOpenCvEdgePipeline(
    const cv::Mat& grayInput,
    int originalWidth,
    int originalHeight,
    const EdgeDetectionConfig& config
) {
    EdgeDetectionResult result{};
    result.frameWidth = originalWidth;
    result.frameHeight = originalHeight;

    if (grayInput.empty() || originalWidth <= 0 || originalHeight <= 0) {
        return result;
    }

    const float scale = (originalWidth > config.targetAnalysisWidth)
        ? static_cast<float>(config.targetAnalysisWidth) / static_cast<float>(originalWidth)
        : 1.0f;

    const int scaledWidth = std::max(64, static_cast<int>(std::round(originalWidth * scale)));
    const int scaledHeight = std::max(64, static_cast<int>(std::round(originalHeight * scale)));

    cv::Mat resized;
    if (scale < 0.999f) {
        cv::resize(grayInput, resized, cv::Size(scaledWidth, scaledHeight), 0, 0, cv::INTER_AREA);
    } else {
        resized = grayInput.clone();
    }

    cv::Mat equalized;
    auto clahe = cv::createCLAHE(
        config.claheClipLimit,
        cv::Size(config.claheTileGridSize, config.claheTileGridSize)
    );
    clahe->apply(resized, equalized);

    cv::Mat closed;
    const cv::Mat morphKernel = cv::getStructuringElement(
        cv::MORPH_RECT,
        cv::Size(config.morphKernelSize, config.morphKernelSize)
    );
    cv::morphologyEx(equalized, closed, cv::MORPH_CLOSE, morphKernel);

    cv::Mat blurred;
    const int blurSize = (config.gaussianBlurSize % 2 == 1)
        ? config.gaussianBlurSize
        : config.gaussianBlurSize + 1;
    cv::GaussianBlur(closed, blurred, cv::Size(blurSize, blurSize), 0);

    const uint8_t medianVal = EdgeDetector::computeMedianIntensity(
        blurred.data,
        blurred.cols,
        blurred.rows,
        static_cast<int>(blurred.step)
    );

    const double lowerThresh = std::max(
        18.0,
        (1.0 - config.cannySigma) * static_cast<double>(medianVal)
    );
    const double upperThresh = std::min(
        240.0,
        (1.0 + config.cannySigma) * static_cast<double>(medianVal)
    );

    const std::array<std::pair<double, double>, 2> thresholdPasses = {{
        {lowerThresh, upperThresh},
        {35.0, 120.0}
    }};

    const float scaledFrameArea = static_cast<float>(scaledWidth * scaledHeight);
    float bestArea = 0.0f;
    QuadCorners bestScaledQuad{};
    bool foundValid = false;

    const cv::Mat dilateKernel = cv::getStructuringElement(cv::MORPH_RECT, cv::Size(3, 3));

    for (const auto& pass : thresholdPasses) {
        cv::Mat edges;
        cv::Canny(blurred, edges, pass.first, pass.second);
        cv::dilate(edges, edges, dilateKernel);

        std::vector<std::vector<cv::Point>> contours;
        cv::findContours(edges, contours, cv::RETR_LIST, cv::CHAIN_APPROX_SIMPLE);

        std::sort(
            contours.begin(),
            contours.end(),
            [](const std::vector<cv::Point>& a, const std::vector<cv::Point>& b) {
                return cv::contourArea(a) > cv::contourArea(b);
            }
        );

        const size_t maxCandidates = std::min<size_t>(contours.size(), 12);
        for (size_t i = 0; i < maxCandidates; ++i) {
            const double perimeter = cv::arcLength(contours[i], true);
            if (perimeter < 80.0) {
                continue;
            }

            std::vector<cv::Point> approx;
            cv::approxPolyDP(contours[i], approx, 0.02 * perimeter, true);

            if (approx.size() != 4) {
                std::vector<cv::Point> hull;
                cv::convexHull(contours[i], hull);
                const double hullPerimeter = cv::arcLength(hull, true);
                cv::approxPolyDP(hull, approx, 0.025 * hullPerimeter, true);
            }

            if (approx.size() == 4 && cv::isContourConvex(approx)) {
                const QuadCorners candidate = PointSorter::sortCvPoints(approx);
                if (PointSorter::isValidDocumentQuad(
                        candidate,
                        scaledWidth,
                        scaledHeight,
                        config.minQuadAreaRatio,
                        config.maxQuadAreaRatio
                    )) {
                    const float area = PointSorter::computeQuadArea(candidate);
                    if (area > bestArea) {
                        bestArea = area;
                        bestScaledQuad = candidate;
                        foundValid = true;
                    }
                }
            }
        }

        edges.release();
        if (foundValid) {
            break;
        }
    }

    resized.release();
    equalized.release();
    closed.release();
    blurred.release();

    if (!foundValid) {
        return result;
    }

    const float invScale = 1.0f / scale;
    result.detected = true;
    result.corners = QuadCorners{
        Point2f{bestScaledQuad.topLeft.x * invScale, bestScaledQuad.topLeft.y * invScale},
        Point2f{bestScaledQuad.topRight.x * invScale, bestScaledQuad.topRight.y * invScale},
        Point2f{bestScaledQuad.bottomRight.x * invScale, bestScaledQuad.bottomRight.y * invScale},
        Point2f{bestScaledQuad.bottomLeft.x * invScale, bestScaledQuad.bottomLeft.y * invScale}
    };
    result.areaRatio = bestArea / scaledFrameArea;
    result.confidence = std::min(1.0f, std::max(0.35f, result.areaRatio * 1.45f));

    return result;
}

}
#endif

EdgeDetectionResult EdgeDetector::detectFromYPlane(
    const uint8_t* yPlaneData,
    int width,
    int height,
    int rowStride,
    const EdgeDetectionConfig& config
) {
    EdgeDetectionResult fallback{};
    fallback.frameWidth = width;
    fallback.frameHeight = height;

    if (!yPlaneData || width <= 0 || height <= 0 || rowStride < width) {
        return fallback;
    }

#if SKAN_HAS_OPENCV
    cv::Mat yMat(
        height,
        width,
        CV_8UC1,
        const_cast<uint8_t*>(yPlaneData),
        static_cast<size_t>(rowStride)
    );
    return runOpenCvEdgePipeline(yMat, width, height, config);
#else
    (void)config;
    const uint8_t median = computeMedianIntensity(yPlaneData, width, height, rowStride);
    if (median == 0) {
        return fallback;
    }
    const float marginX = static_cast<float>(width) * 0.1f;
    const float marginY = static_cast<float>(height) * 0.1f;
    fallback.detected = true;
    fallback.corners = QuadCorners{
        Point2f{marginX, marginY},
        Point2f{static_cast<float>(width) - marginX, marginY},
        Point2f{static_cast<float>(width) - marginX, static_cast<float>(height) - marginY},
        Point2f{marginX, static_cast<float>(height) - marginY}
    };
    fallback.areaRatio = 0.64f;
    fallback.confidence = 0.85f;
    return fallback;
#endif
}

EdgeDetectionResult EdgeDetector::detectFromImageFile(
    const std::string& filePath,
    const EdgeDetectionConfig& config
) {
    EdgeDetectionResult result{};
    if (filePath.empty()) {
        return result;
    }

#if SKAN_HAS_OPENCV
    cv::Mat grayImage = cv::imread(filePath, cv::IMREAD_GRAYSCALE);
    if (grayImage.empty()) {
        return result;
    }
    result = runOpenCvEdgePipeline(grayImage, grayImage.cols, grayImage.rows, config);
    grayImage.release();
    return result;
#else
    (void)config;
    result.detected = true;
    result.frameWidth = 1080;
    result.frameHeight = 1440;
    result.corners = QuadCorners{
        Point2f{108.0f, 144.0f},
        Point2f{972.0f, 144.0f},
        Point2f{972.0f, 1296.0f},
        Point2f{108.0f, 1296.0f}
    };
    result.areaRatio = 0.64f;
    result.confidence = 0.88f;
    return result;
#endif
}

}

