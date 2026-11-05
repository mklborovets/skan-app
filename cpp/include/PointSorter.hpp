#pragma once

#include <array>
#include <vector>

#if __has_include(<opencv2/core.hpp>)
#include <opencv2/core.hpp>
#define SKAN_HAS_OPENCV 1
#else
#define SKAN_HAS_OPENCV 0
#endif

namespace skan {

struct Point2f {
    float x;
    float y;
};

struct QuadCorners {
    Point2f topLeft;
    Point2f topRight;
    Point2f bottomRight;
    Point2f bottomLeft;

    std::array<Point2f, 4> toArray() const {
        return {topLeft, topRight, bottomRight, bottomLeft};
    }
};

struct TargetDimensions {
    int width;
    int height;
    float aspectRatio;
};

class PointSorter {
public:
    static QuadCorners sortPoints(const std::array<Point2f, 4>& rawPoints);

    static float distanceBetween(const Point2f& a, const Point2f& b);

    static float computeQuadArea(const QuadCorners& quad);

    static bool isQuadConvex(const QuadCorners& quad);

    static bool hasValidInteriorAngles(
        const QuadCorners& quad,
        float maxAbsCosine = 0.82f
    );

    static bool isValidDocumentQuad(
        const QuadCorners& quad,
        int frameWidth,
        int frameHeight,
        float minAreaRatio = 0.15f,
        float maxAreaRatio = 0.98f
    );

    static TargetDimensions computeTargetDimensions(const QuadCorners& quad);

#if SKAN_HAS_OPENCV
    static QuadCorners sortCvPoints(const std::vector<cv::Point>& contour);
    static std::array<cv::Point2f, 4> toCvArray(const QuadCorners& quad);
#endif
};

}
