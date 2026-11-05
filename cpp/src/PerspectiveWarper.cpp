#include "PerspectiveWarper.hpp"

#include "PointSorter.hpp"
#include <fstream>

#if SKAN_HAS_OPENCV
#include <array>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>
#include <vector>
#endif

namespace skan {

#if SKAN_HAS_OPENCV
cv::Mat PerspectiveWarper::warpMatrixToRect(
    const cv::Mat& sourceImage,
    const QuadCorners& rawCorners,
    TargetDimensions* outDimensions
) {
    if (sourceImage.empty()) {
        return cv::Mat();
    }

    const QuadCorners ordered = PointSorter::sortPoints(rawCorners.toArray());
    const TargetDimensions dims = PointSorter::computeTargetDimensions(ordered);

    if (outDimensions) {
        *outDimensions = dims;
    }

    const std::array<cv::Point2f, 4> srcPts = PointSorter::toCvArray(ordered);
    const std::array<cv::Point2f, 4> dstPts = {
        cv::Point2f(0.0f, 0.0f),
        cv::Point2f(static_cast<float>(dims.width - 1), 0.0f),
        cv::Point2f(static_cast<float>(dims.width - 1), static_cast<float>(dims.height - 1)),
        cv::Point2f(0.0f, static_cast<float>(dims.height - 1))
    };

    cv::Mat transformMatrix = cv::getPerspectiveTransform(srcPts.data(), dstPts.data());
    cv::Mat warpedImage;
    cv::warpPerspective(
        sourceImage,
        warpedImage,
        transformMatrix,
        cv::Size(dims.width, dims.height),
        cv::INTER_CUBIC,
        cv::BORDER_REPLICATE
    );
    transformMatrix.release();

    return warpedImage;
}
#endif

WarpOutputInfo PerspectiveWarper::warpFileToFile(
    const std::string& inputFilePath,
    const std::string& outputFilePath,
    const QuadCorners& rawCorners,
    int jpegQuality
) {
    WarpOutputInfo info{};
    if (inputFilePath.empty() || outputFilePath.empty()) {
        return info;
    }

    const QuadCorners ordered = PointSorter::sortPoints(rawCorners.toArray());

#if SKAN_HAS_OPENCV
    cv::Mat src = cv::imread(inputFilePath, cv::IMREAD_COLOR);
    if (src.empty()) {
        return info;
    }

    TargetDimensions actualDims{};
    cv::Mat warped = warpMatrixToRect(src, ordered, &actualDims);
    src.release();

    if (warped.empty()) {
        return info;
    }

    const std::vector<int> encodeParams = {
        cv::IMWRITE_JPEG_QUALITY,
        jpegQuality
    };
    const bool saved = cv::imwrite(outputFilePath, warped, encodeParams);
    warped.release();

    if (saved) {
        info.success = true;
        info.outputPath = outputFilePath;
        info.width = actualDims.width;
        info.height = actualDims.height;
    }
    return info;
#else
    (void)jpegQuality;
    const TargetDimensions dims = PointSorter::computeTargetDimensions(ordered);
    std::ifstream inFile(inputFilePath, std::ios::binary);
    std::ofstream outFile(outputFilePath, std::ios::binary);
    if (inFile && outFile) {
        outFile << inFile.rdbuf();
        info.success = true;
        info.outputPath = outputFilePath;
        info.width = dims.width;
        info.height = dims.height;
    }
    return info;
#endif
}

}
