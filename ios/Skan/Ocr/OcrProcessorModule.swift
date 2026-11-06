import Foundation
import UIKit
import ImageIO
import Vision
import React

@objc(OcrProcessorModule)
class OcrProcessorModule: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    private static func cgOrientation(from uiOrientation: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch uiOrientation {
        case .up: return .up
        case .down: return .down
        case .left: return .left
        case .right: return .right
        case .upMirrored: return .upMirrored
        case .downMirrored: return .downMirrored
        case .leftMirrored: return .leftMirrored
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }

    @objc(recognizeFile:resolver:rejecter:)
    func recognizeFile(
        filePath: String,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.global(qos: .userInitiated).async {
            var cleanPath = filePath.trimmingCharacters(in: .whitespacesAndNewlines)
            if cleanPath.hasPrefix("file://") {
                if let url = URL(string: cleanPath), url.isFileURL {
                    cleanPath = url.path
                } else {
                    cleanPath = String(cleanPath.dropFirst("file://".count))
                }
            }

            guard !cleanPath.isEmpty else {
                resolver([
                    "fullText": "",
                    "blocks": [],
                    "detectedBarcodes": []
                ])
                return
            }

            var loadedImage: UIImage? = UIImage(contentsOfFile: cleanPath)
            if loadedImage == nil, let data = try? Data(contentsOf: URL(fileURLWithPath: cleanPath)) {
                loadedImage = UIImage(data: data)
            }

            guard let image = loadedImage,
                  let cgImage = image.cgImage else {
                resolver([
                    "fullText": "",
                    "blocks": [],
                    "detectedBarcodes": []
                ])
                return
            }

            let orientedWidth = image.size.width * image.scale
            let orientedHeight = image.size.height * image.scale
            let imgWidth = max(1.0, orientedWidth > 0 ? orientedWidth : CGFloat(cgImage.width))
            let imgHeight = max(1.0, orientedHeight > 0 ? orientedHeight : CGFloat(cgImage.height))
            let orientation = Self.cgOrientation(from: image.imageOrientation)

            var recognizedLines: [String] = []
            var blocksOutput: [[String: Any]] = []
            var barcodesOutput: [String] = []

            let textRequest = VNRecognizeTextRequest { request, _ in
                guard let observations = request.results as? [VNRecognizedTextObservation] else {
                    return
                }
                for obs in observations {
                    guard let topCandidate = obs.topCandidates(1).first else {
                        continue
                    }
                    recognizedLines.append(topCandidate.string)
                    let box = obs.boundingBox
                    let normX = box.origin.x
                    let normY = 1.0 - box.origin.y - box.height
                    let normW = box.width
                    let normH = box.height

                    blocksOutput.append([
                        "text": topCandidate.string,
                        "confidence": Double(topCandidate.confidence),
                        "boundingBox": [
                            "x": normX * imgWidth,
                            "y": normY * imgHeight,
                            "width": normW * imgWidth,
                            "height": normH * imgHeight
                        ],
                        "normalizedBox": [
                            "x": normX,
                            "y": normY,
                            "width": normW,
                            "height": normH
                        ]
                    ])
                }
            }
            textRequest.recognitionLevel = .accurate
            textRequest.usesLanguageCorrection = true
            if #available(iOS 16.0, *) {
                textRequest.recognitionLanguages = ["uk-UA", "en-US", "uk", "en"]
                textRequest.automaticallyDetectsLanguage = true
            }

            let barcodeRequest = VNDetectBarcodesRequest { request, _ in
                guard let observations = request.results as? [VNBarcodeObservation] else {
                    return
                }
                for barcode in observations {
                    if let payload = barcode.payloadStringValue, !payload.isEmpty {
                        barcodesOutput.append(payload)
                    }
                }
            }

            let textHandler = VNImageRequestHandler(
                cgImage: cgImage,
                orientation: orientation,
                options: [:]
            )
            do {
                try textHandler.perform([textRequest])
            } catch {
                // Keep empty text if Vision text recognition fails
            }

            let barcodeHandler = VNImageRequestHandler(
                cgImage: cgImage,
                orientation: orientation,
                options: [:]
            )
            try? barcodeHandler.perform([barcodeRequest])

            resolver([
                "fullText": recognizedLines.joined(separator: "\n"),
                "blocks": blocksOutput,
                "detectedBarcodes": barcodesOutput
            ])
        }
    }
}

