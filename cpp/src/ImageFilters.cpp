#include "ImageFilters.hpp"

#include "PerspectiveWarper.hpp"
#include "PointSorter.hpp"

#if SKAN_HAS_OPENCV
#include <algorithm>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>
#include <vector>
#endif

namespace skan {

FilterPreset ImageFilters::parsePresetName(const std::string& presetName) {
    if (presetName == "bw_document" || presetName == "bw") {
        return FilterPreset::BwDocument;
    }
    if (presetName == "grayscale" || presetName == "gray") {
        return FilterPreset::Grayscale;
    }
    if (presetName == "enhanced_color" || presetName == "enhanced") {
        return FilterPreset::EnhancedColor;
    }
    return FilterPreset::Original;
}

std::string ImageFilters::presetToString(FilterPreset preset) {
    switch (preset) {
        case FilterPreset::BwDocument:
            return "bw_document";
        case FilterPreset::Grayscale:
            return "grayscale";
        case FilterPreset::EnhancedColor:
            return "enhanced_color";
        case FilterPreset::Original:
        default:
            return "original";
    }
}

#if SKAN_HAS_OPENCV
namespace {

cv::Mat applyGrayscaleContrast(const cv::Mat& bgrInput, const FilterOptions& options) {
    cv::Mat gray;
    if (bgrInput.channels() == 3) {
        cv::cvtColor(bgrInput, gray, cv::COLOR_BGR2GRAY);
    } else if (bgrInput.channels() == 4) {
        cv::cvtColor(bgrInput, gray, cv::COLOR_BGRA2GRAY);
    } else {
        gray = bgrInput.clone();
    }

    cv::Mat normalized;
    cv::normalize(gray, normalized, 0, 255, cv::NORM_MINMAX);
    gray.release();

    cv::Mat enhanced;
    auto clahe = cv::createCLAHE(
        options.claheClipLimit,
        cv::Size(options.claheGridSize, options.claheGridSize)
    );
    clahe->apply(normalized, enhanced);
    normalized.release();

    return enhanced;
}

cv::Mat applyShadowFreeBinarization(const cv::Mat& bgrInput, const FilterOptions& options) {
    cv::Mat gray;
    if (bgrInput.channels() == 3) {
        cv::cvtColor(bgrInput, gray, cv::COLOR_BGR2GRAY);
    } else if (bgrInput.channels() == 4) {
        cv::cvtColor(bgrInput, gray, cv::COLOR_BGRA2GRAY);
    } else {
        gray = bgrInput.clone();
    }

    const int maxDim = std::max(gray.cols, gray.rows);
    const double bgScale = (maxDim > 800) ? (800.0 / static_cast<double>(maxDim)) : 1.0;
    cv::Mat smallGray;
    if (bgScale < 0.99) {
        cv::resize(
            gray,
            smallGray,
            cv::Size(
                std::max(16, static_cast<int>(gray.cols * bgScale)),
                std::max(16, static_cast<int>(gray.rows * bgScale))
            ),
            0,
            0,
            cv::INTER_AREA
        );
    } else {
        smallGray = gray;
    }

    cv::Mat dilated;
    const cv::Mat dilateKernel = cv::getStructuringElement(cv::MORPH_RECT, cv::Size(7, 7));
    cv::dilate(smallGray, dilated, dilateKernel);

    const int scaledBlur = std::max(
        3,
        static_cast<int>(options.shadowBlurKernelSize * bgScale)
    );
    const int blurSize = std::min(
        31,
        (scaledBlur % 2 == 1) ? scaledBlur : scaledBlur + 1
    );
    cv::Mat smallBackground;
    cv::medianBlur(dilated, smallBackground, blurSize);
    dilated.release();

    cv::Mat background;
    if (bgScale < 0.99) {
        cv::resize(smallBackground, background, gray.size(), 0, 0, cv::INTER_LINEAR);
        smallBackground.release();
    } else {
        background = smallBackground;
    }

    cv::Mat illuminationNormalized;
    cv::divide(gray, background, illuminationNormalized, 255.0);
    gray.release();
    background.release();

    cv::Mat denoised;
    cv::GaussianBlur(illuminationNormalized, denoised, cv::Size(3, 3), 0);
    illuminationNormalized.release();

    const int blockSize = std::max(
        3,
        (options.adaptiveBlockSize % 2 == 1)
            ? options.adaptiveBlockSize
            : options.adaptiveBlockSize + 1
    );

    cv::Mat binary;
    cv::adaptiveThreshold(
        denoised,
        binary,
        255.0,
        cv::ADAPTIVE_THRESH_GAUSSIAN_C,
        cv::THRESH_BINARY,
        blockSize,
        options.adaptiveConstantC
    );
    denoised.release();

    return binary;
}

cv::Mat applyEnhancedColorLab(const cv::Mat& bgrInput, const FilterOptions& options) {
    cv::Mat colorInput;
    if (bgrInput.channels() == 1) {
        cv::cvtColor(bgrInput, colorInput, cv::COLOR_GRAY2BGR);
    } else if (bgrInput.channels() == 4) {
        cv::cvtColor(bgrInput, colorInput, cv::COLOR_BGRA2BGR);
    } else {
        colorInput = bgrInput;
    }

    cv::Mat lab;
    cv::cvtColor(colorInput, lab, cv::COLOR_BGR2Lab);

    std::vector<cv::Mat> labChannels(3);
    cv::split(lab, labChannels);
    lab.release();

    auto clahe = cv::createCLAHE(
        options.claheClipLimit,
        cv::Size(options.claheGridSize, options.claheGridSize)
    );
    cv::Mat enhancedL;
    clahe->apply(labChannels[0], enhancedL);
    labChannels[0].release();
    labChannels[0] = enhancedL;

    cv::Mat mergedLab;
    cv::merge(labChannels, mergedLab);
    for (auto& ch : labChannels) {
        ch.release();
    }

    cv::Mat enhancedBgr;
    cv::cvtColor(mergedLab, enhancedBgr, cv::COLOR_Lab2BGR);
    mergedLab.release();

    return enhancedBgr;
}

}

cv::Mat ImageFilters::applyPresetToMat(
    const cv::Mat& bgrInput,
    FilterPreset preset,
    const FilterOptions& options
) {
    if (bgrInput.empty()) {
        return cv::Mat();
    }

    switch (preset) {
        case FilterPreset::Grayscale:
            return applyGrayscaleContrast(bgrInput, options);
        case FilterPreset::BwDocument:
            return applyShadowFreeBinarization(bgrInput, options);
        case FilterPreset::EnhancedColor:
            return applyEnhancedColorLab(bgrInput, options);
        case FilterPreset::Original:
        default:
            return bgrInput.clone();
    }
}
#endif

ProcessedImageOutput ImageFilters::warpAndFilterToFile(
    const std::string& inputFilePath,
    const std::string& outputFilePath,
    const QuadCorners& corners,
    FilterPreset preset,
    const FilterOptions& options
) {
    ProcessedImageOutput output{};
    output.appliedPreset = preset;

    if (inputFilePath.empty() || outputFilePath.empty()) {
        return output;
    }

#if SKAN_HAS_OPENCV
    cv::Mat sourceImage = cv::imread(inputFilePath, cv::IMREAD_COLOR);
    if (sourceImage.empty()) {
        return output;
    }

    TargetDimensions dims{};
    cv::Mat warped = PerspectiveWarper::warpMatrixToRect(sourceImage, corners, &dims);
    sourceImage.release();

    if (warped.empty()) {
        return output;
    }

    cv::Mat filtered = applyPresetToMat(warped, preset, options);
    warped.release();

    if (filtered.empty()) {
        return output;
    }

    const std::vector<int> encodeParams = {
        cv::IMWRITE_JPEG_QUALITY,
        options.jpegQuality
    };
    const bool written = cv::imwrite(outputFilePath, filtered, encodeParams);
    filtered.release();

    if (written) {
        output.success = true;
        output.outputPath = outputFilePath;
        output.width = dims.width;
        output.height = dims.height;
    }
    return output;
#else
    const WarpOutputInfo warpResult = PerspectiveWarper::warpFileToFile(
        inputFilePath,
        outputFilePath,
        corners,
        options.jpegQuality
    );
    output.success = warpResult.success;
    output.outputPath = warpResult.outputPath;
    output.width = warpResult.width;
    output.height = warpResult.height;
    return output;
#endif
}

}

