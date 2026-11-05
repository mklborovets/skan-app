#include "SkanOpenCvJsiModule.hpp"

#include "EdgeDetector.hpp"
#include "ImageFilters.hpp"
#include "PointSorter.hpp"

#include <cstddef>
#include <string>
#include <utility>

namespace skan {

namespace {

facebook::jsi::Object createPointObject(
    facebook::jsi::Runtime& rt,
    const Point2f& pt
) {
    facebook::jsi::Object obj(rt);
    obj.setProperty(rt, "x", static_cast<double>(pt.x));
    obj.setProperty(rt, "y", static_cast<double>(pt.y));
    return obj;
}

facebook::jsi::Object createQuadObject(
    facebook::jsi::Runtime& rt,
    const QuadCorners& quad
) {
    facebook::jsi::Object obj(rt);
    obj.setProperty(rt, "topLeft", createPointObject(rt, quad.topLeft));
    obj.setProperty(rt, "topRight", createPointObject(rt, quad.topRight));
    obj.setProperty(rt, "bottomRight", createPointObject(rt, quad.bottomRight));
    obj.setProperty(rt, "bottomLeft", createPointObject(rt, quad.bottomLeft));
    return obj;
}

Point2f parsePointObject(
    facebook::jsi::Runtime& rt,
    const facebook::jsi::Object& obj
) {
    const float x = static_cast<float>(obj.getProperty(rt, "x").asNumber());
    const float y = static_cast<float>(obj.getProperty(rt, "y").asNumber());
    return Point2f{x, y};
}

QuadCorners parseQuadObject(
    facebook::jsi::Runtime& rt,
    const facebook::jsi::Object& obj
) {
    const Point2f tl = parsePointObject(rt, obj.getPropertyAsObject(rt, "topLeft"));
    const Point2f tr = parsePointObject(rt, obj.getPropertyAsObject(rt, "topRight"));
    const Point2f br = parsePointObject(rt, obj.getPropertyAsObject(rt, "bottomRight"));
    const Point2f bl = parsePointObject(rt, obj.getPropertyAsObject(rt, "bottomLeft"));
    return QuadCorners{tl, tr, br, bl};
}

}

void SkanOpenCvJsiModule::install(facebook::jsi::Runtime& runtime) {
    auto detectStaticEdgesHostFn = facebook::jsi::Function::createFromHostFunction(
        runtime,
        facebook::jsi::PropNameID::forAscii(runtime, "__skanDetectStaticEdges"),
        1,
        [](facebook::jsi::Runtime& rt,
           const facebook::jsi::Value&,
           const facebook::jsi::Value* args,
           size_t count) -> facebook::jsi::Value {
            if (count < 1 || !args[0].isString()) {
                throw facebook::jsi::JSError(rt, "__skanDetectStaticEdges requires filePath string");
            }

            const std::string filePath = args[0].asString(rt).utf8(rt);
            const EdgeDetectionResult detection = EdgeDetector::detectFromImageFile(filePath);

            facebook::jsi::Object response(rt);
            response.setProperty(rt, "detected", detection.detected);
            response.setProperty(rt, "confidence", static_cast<double>(detection.confidence));
            response.setProperty(rt, "areaRatio", static_cast<double>(detection.areaRatio));
            response.setProperty(rt, "frameWidth", detection.frameWidth);
            response.setProperty(rt, "frameHeight", detection.frameHeight);
            response.setProperty(rt, "corners", createQuadObject(rt, detection.corners));
            return response;
        }
    );

    auto warpAndFilterHostFn = facebook::jsi::Function::createFromHostFunction(
        runtime,
        facebook::jsi::PropNameID::forAscii(runtime, "__skanWarpAndFilterImage"),
        4,
        [](facebook::jsi::Runtime& rt,
           const facebook::jsi::Value&,
           const facebook::jsi::Value* args,
           size_t count) -> facebook::jsi::Value {
            if (count < 4 || !args[0].isString() || !args[1].isString() ||
                !args[2].isObject() || !args[3].isString()) {
                throw facebook::jsi::JSError(
                    rt,
                    "__skanWarpAndFilterImage requires (inputPath, outputPath, corners, preset)"
                );
            }

            const std::string inputPath = args[0].asString(rt).utf8(rt);
            const std::string outputPath = args[1].asString(rt).utf8(rt);
            const QuadCorners corners = parseQuadObject(rt, args[2].asObject(rt));
            const std::string presetName = args[3].asString(rt).utf8(rt);

            const FilterPreset preset = ImageFilters::parsePresetName(presetName);
            const ProcessedImageOutput processed = ImageFilters::warpAndFilterToFile(
                inputPath,
                outputPath,
                corners,
                preset
            );

            facebook::jsi::Object response(rt);
            response.setProperty(rt, "success", processed.success);
            response.setProperty(
                rt,
                "outputPath",
                facebook::jsi::String::createFromUtf8(rt, processed.outputPath)
            );
            response.setProperty(rt, "width", processed.width);
            response.setProperty(rt, "height", processed.height);
            response.setProperty(
                rt,
                "appliedPreset",
                facebook::jsi::String::createFromUtf8(
                    rt,
                    ImageFilters::presetToString(processed.appliedPreset)
                )
            );
            return response;
        }
    );

    runtime.global().setProperty(
        runtime,
        "__skanDetectStaticEdges",
        std::move(detectStaticEdgesHostFn)
    );
    runtime.global().setProperty(
        runtime,
        "__skanWarpAndFilterImage",
        std::move(warpAndFilterHostFn)
    );
}

}

