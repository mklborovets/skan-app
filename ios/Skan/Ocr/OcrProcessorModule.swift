import Foundation
import UIKit
import Vision
import React

@objc(OcrProcessorModule)
class OcrProcessorModule: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc(recognizeFile:resolver:rejecter:)
    func recognizeFile(
        filePath: String,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.global(qos: .userInitiated).async {
            guard let image = UIImage(contentsOfFile: filePath),
                  let cgImage = image.cgImage else {
                rejecter("OCR_IMAGE_ERROR", "Unable to load image at \(filePath)", nil)
                return
            }

            let imgWidth = max(1.0, CGFloat(cgImage.width))
            let imgHeight = max(1.0, CGFloat(cgImage.height))

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

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([textRequest, barcodeRequest])
                resolver([
                    "fullText": recognizedLines.joined(separator: "\n"),
                    "blocks": blocksOutput,
                    "detectedBarcodes": barcodesOutput
                ])
            } catch {
                rejecter("OCR_VISION_ERROR", error.localizedDescription, error)
            }
        }
    }
}
