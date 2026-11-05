#include "PointSorter.hpp"

#include <algorithm>
#include <cmath>
#include <cstddef>

namespace skan {

std::array<Point2f, 4> QuadCorners::toArray() const {
    return {topLeft, topRight, bottomRight, bottomLeft};
}

namespace {

float crossProductZ(const Point2f& o, const Point2f& a, const Point2f& b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

float angleCosine(const Point2f& pt1, const Point2f& pt2, const Point2f& pt0) {
    const float dx1 = pt1.x - pt0.x;
    const float dy1 = pt1.y - pt0.y;
    const float dx2 = pt2.x - pt0.x;
    const float dy2 = pt2.y - pt0.y;
    const float denom = std::sqrt((dx1 * dx1 + dy1 * dy1) * (dx2 * dx2 + dy2 * dy2) + 1e-10f);
    return (dx1 * dx2 + dy1 * dy2) / denom;
}

}

QuadCorners PointSorter::sortPoints(const std::array<Point2f, 4>& rawPoints) {
    float centerX = 0.0f;
    float centerY = 0.0f;
    for (const auto& pt : rawPoints) {
        centerX += pt.x;
        centerY += pt.y;
    }
    centerX *= 0.25f;
    centerY *= 0.25f;

    std::array<Point2f, 4> clockwisePts = rawPoints;
    std::sort(
        clockwisePts.begin(),
        clockwisePts.end(),
        [centerX, centerY](const Point2f& a, const Point2f& b) {
            const float angleA = std::atan2(a.y - centerY, a.x - centerX);
            const float angleB = std::atan2(b.y - centerY, b.x - centerX);
            return angleA < angleB;
        }
    );

    size_t topLeftIndex = 0;
    float minScore = clockwisePts[0].x + clockwisePts[0].y;
    for (size_t i = 1; i < 4; ++i) {
        const float score = clockwisePts[i].x + clockwisePts[i].y;
        if (score < minScore) {
            minScore = score;
            topLeftIndex = i;
        }
    }

    return QuadCorners{
        clockwisePts[topLeftIndex],
        clockwisePts[(topLeftIndex + 1) % 4],
        clockwisePts[(topLeftIndex + 2) % 4],
        clockwisePts[(topLeftIndex + 3) % 4]
    };
}

float PointSorter::distanceBetween(const Point2f& a, const Point2f& b) {
    const float dx = b.x - a.x;
    const float dy = b.y - a.y;
    return std::hypot(dx, dy);
}

float PointSorter::computeQuadArea(const QuadCorners& quad) {
    const auto pts = quad.toArray();
    float shoelaceSum = 0.0f;
    for (size_t i = 0; i < 4; ++i) {
        const Point2f& current = pts[i];
        const Point2f& next = pts[(i + 1) % 4];
        shoelaceSum += (current.x * next.y) - (next.x * current.y);
    }
    return 0.5f * std::fabs(shoelaceSum);
}

bool PointSorter::isQuadConvex(const QuadCorners& quad) {
    const auto pts = quad.toArray();
    bool hasPositive = false;
    bool hasNegative = false;

    for (size_t i = 0; i < 4; ++i) {
        const Point2f& a = pts[i];
        const Point2f& b = pts[(i + 1) % 4];
        const Point2f& c = pts[(i + 2) % 4];
        const float cross = crossProductZ(a, b, c);
        if (std::fabs(cross) < 1e-3f) {
            return false;
        }
        if (cross > 0.0f) {
            hasPositive = true;
        } else {
            hasNegative = true;
        }
    }

    return !(hasPositive && hasNegative);
}

bool PointSorter::hasValidInteriorAngles(
    const QuadCorners& quad,
    float maxAbsCosine
) {
    const auto pts = quad.toArray();
    float maxCos = 0.0f;

    for (size_t i = 0; i < 4; ++i) {
        const Point2f& prev = pts[(i + 3) % 4];
        const Point2f& curr = pts[i];
        const Point2f& next = pts[(i + 1) % 4];
        const float cosVal = std::fabs(angleCosine(prev, next, curr));
        maxCos = std::max(maxCos, cosVal);
    }

    return maxCos <= maxAbsCosine;
}

bool PointSorter::isValidDocumentQuad(
    const QuadCorners& quad,
    int frameWidth,
    int frameHeight,
    float minAreaRatio,
    float maxAreaRatio
) {
    if (frameWidth <= 0 || frameHeight <= 0) {
        return false;
    }

    if (!isQuadConvex(quad)) {
        return false;
    }

    if (!hasValidInteriorAngles(quad)) {
        return false;
    }

    const float frameArea = static_cast<float>(frameWidth) * static_cast<float>(frameHeight);
    const float quadArea = computeQuadArea(quad);
    const float areaRatio = quadArea / frameArea;

    if (areaRatio < minAreaRatio || areaRatio > maxAreaRatio) {
        return false;
    }

    const auto dims = computeTargetDimensions(quad);
    if (dims.width < 32 || dims.height < 32) {
        return false;
    }

    if (dims.aspectRatio < 0.25f || dims.aspectRatio > 4.0f) {
        return false;
    }

    return true;
}

TargetDimensions PointSorter::computeTargetDimensions(const QuadCorners& quad) {
    const float topWidth = distanceBetween(quad.topLeft, quad.topRight);
    const float bottomWidth = distanceBetween(quad.bottomLeft, quad.bottomRight);
    const float leftHeight = distanceBetween(quad.topLeft, quad.bottomLeft);
    const float rightHeight = distanceBetween(quad.topRight, quad.bottomRight);

    const int maxWidth = std::max(1, static_cast<int>(std::round(std::max(topWidth, bottomWidth))));
    const int maxHeight = std::max(1, static_cast<int>(std::round(std::max(leftHeight, rightHeight))));
    const float aspectRatio = static_cast<float>(maxWidth) / static_cast<float>(maxHeight);

    return TargetDimensions{
        maxWidth,
        maxHeight,
        aspectRatio
    };
}

#if SKAN_HAS_OPENCV
QuadCorners PointSorter::sortCvPoints(const std::vector<cv::Point>& contour) {
    std::array<Point2f, 4> rawPoints{};
    for (size_t i = 0; i < 4 && i < contour.size(); ++i) {
        rawPoints[i] = Point2f{
            static_cast<float>(contour[i].x),
            static_cast<float>(contour[i].y)
        };
    }
    return sortPoints(rawPoints);
}

std::array<cv::Point2f, 4> PointSorter::toCvArray(const QuadCorners& quad) {
    return {
        cv::Point2f(quad.topLeft.x, quad.topLeft.y),
        cv::Point2f(quad.topRight.x, quad.topRight.y),
        cv::Point2f(quad.bottomRight.x, quad.bottomRight.y),
        cv::Point2f(quad.bottomLeft.x, quad.bottomLeft.y)
    };
}
#endif

}

