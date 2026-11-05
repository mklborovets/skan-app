import Foundation
import UIKit
import PDFKit
import React

@objc(PdfGeneratorModule)
class PdfGeneratorModule: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc(generateSearchablePdf:resolver:rejecter:)
    func generateSearchablePdf(
        options: NSDictionary,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.global(qos: .userInitiated).async {
            guard let outputFilePath = options["outputFilePath"] as? String,
                  let pages = options["pages"] as? [NSDictionary] else {
                rejecter("PDF_INVALID_ARGS", "Missing outputFilePath or pages", nil)
                return
            }

            let title = (options["title"] as? String) ?? "SKAN Document"
            let author = (options["author"] as? String) ?? "SKAN On-Device Scanner"
            let jpegQuality = CGFloat((options["jpegQuality"] as? Int) ?? 85) / 100.0

            let pageRect = CGRect(x: 0, y: 0, width: 595.0, height: 842.0)
            let pdfMeta: [CFString: Any] = [
                kCGPDFContextTitle: title,
                kCGPDFContextAuthor: author,
                kCGPDFContextCreator: "SKAN React Native OpenCV"
            ]

            let format = UIGraphicsPDFRendererFormat()
            format.documentInfo = pdfMeta as [String: Any]

            let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)
            let outputUrl = URL(fileURLWithPath: outputFilePath)

            do {
                try FileManager.default.createDirectory(
                    at: outputUrl.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )

                try renderer.writePDF(to: outputUrl) { context in
                    for pageEntry in pages {
                        autoreleasepool {
                            context.beginPage()
                            guard let filePath = pageEntry["filePath"] as? String,
                                  let rawImage = UIImage(contentsOfFile: filePath),
                                  let compressedData = rawImage.jpegData(compressionQuality: jpegQuality),
                                  let pageImage = UIImage(data: compressedData) else {
                                return
                            }

                            let fitRect = Self.aspectFitRect(
                                imageSize: pageImage.size,
                                bounds: pageRect
                            )
                            pageImage.draw(in: fitRect)

                            if let ocrBlocks = pageEntry["ocrBlocks"] as? [NSDictionary] {
                                let invisibleAttrs: [NSAttributedString.Key: Any] = [
                                    .foregroundColor: UIColor.clear,
                                    .font: UIFont.systemFont(ofSize: 10.0)
                                ]
                                for block in ocrBlocks {
                                    guard let text = block["text"] as? String,
                                          let norm = block["normalizedBox"] as? NSDictionary,
                                          let nx = norm["x"] as? CGFloat,
                                          let ny = norm["y"] as? CGFloat,
                                          let nw = norm["width"] as? CGFloat,
                                          let nh = norm["height"] as? CGFloat else {
                                        continue
                                    }

                                    let textRect = CGRect(
                                        x: fitRect.origin.x + nx * fitRect.width,
                                        y: fitRect.origin.y + ny * fitRect.height,
                                        width: max(8.0, nw * fitRect.width),
                                        height: max(8.0, nh * fitRect.height)
                                    )
                                    (text as NSString).draw(in: textRect, withAttributes: invisibleAttrs)
                                }
                            }
                        }
                    }
                }

                let attrs = try FileManager.default.attributesOfItem(atPath: outputFilePath)
                let fileSize = (attrs[.size] as? NSNumber)?.doubleValue ?? 0.0

                resolver([
                    "success": true,
                    "pdfPath": outputFilePath,
                    "pageCount": pages.count,
                    "fileSizeBytes": fileSize
                ])
            } catch {
                rejecter("PDF_WRITE_ERROR", error.localizedDescription, error)
            }
        }
    }

    private static func aspectFitRect(imageSize: CGSize, bounds: CGRect) -> CGRect {
        guard imageSize.width > 0 && imageSize.height > 0 else {
            return bounds
        }
        let scale = min(bounds.width / imageSize.width, bounds.height / imageSize.height)
        let width = imageSize.width * scale
        let height = imageSize.height * scale
        let x = bounds.origin.x + (bounds.width - width) * 0.5
        let y = bounds.origin.y + (bounds.height - height) * 0.5
        return CGRect(x: x, y: y, width: width, height: height)
    }
}

