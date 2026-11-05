#pragma once

#include "PointSorter.hpp"
#include <string>

namespace skan {

struct WarpOutputInfo {
    bool success = false;
    std::string outputPath;
    int width = 0;
    int height = 0;
};

class PerspectiveWarper {
public:
#if SKAN_HAS_OPENCV
    static cv::Mat warpMatrixToRect(
        const cv::Mat& sourceImage,
        const QuadCorners& rawCorners,
        TargetDimensions* outDimensions = nullptr
    );
#endif

    static WarpOutputInfo warpFileToFile(
        const std::string& inputFilePath,
        const std::string& outputFilePath,
        const QuadCorners& rawCorners,
        int jpegQuality = 92
    );
};

}

