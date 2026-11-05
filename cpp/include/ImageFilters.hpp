#pragma once

#include "PerspectiveWarper.hpp"
#include "PointSorter.hpp"
#include <string>

namespace skan {

enum class FilterPreset {
    Original,
    Grayscale,
    BwDocument,
    EnhancedColor
};

struct FilterOptions {
    int adaptiveBlockSize = 21;
    double adaptiveConstantC = 10.0;
    double claheClipLimit = 2.5;
    int claheGridSize = 8;
    int shadowBlurKernelSize = 51;
    int jpegQuality = 90;
};

struct ProcessedImageOutput {
    bool success = false;
    std::string outputPath;
    int width = 0;
    int height = 0;
    FilterPreset appliedPreset = FilterPreset::Original;
};

class ImageFilters {
public:
    static FilterPreset parsePresetName(const std::string& presetName);
    static std::string presetToString(FilterPreset preset);

#if SKAN_HAS_OPENCV
    static cv::Mat applyPresetToMat(
        const cv::Mat& bgrInput,
        FilterPreset preset,
        const FilterOptions& options = FilterOptions{}
    );
#endif

    static ProcessedImageOutput warpAndFilterToFile(
        const std::string& inputFilePath,
        const std::string& outputFilePath,
        const QuadCorners& corners,
        FilterPreset preset,
        const FilterOptions& options = FilterOptions{}
    );
};

}
