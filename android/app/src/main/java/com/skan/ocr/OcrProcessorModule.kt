package com.skan.ocr

import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import kotlin.math.max

class OcrProcessorModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OcrProcessorModule"

    @ReactMethod
    fun recognizeFile(filePath: String, promise: Promise) {
        try {
            val cleanFile = File(filePath)
            if (!cleanFile.exists()) {
                promise.reject("OCR_FILE_MISSING", "File not found: $filePath")
                return
            }

            val boundsOpts = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeFile(cleanFile.absolutePath, boundsOpts)
            val imgWidth = max(1f, boundsOpts.outWidth.toFloat())
            val imgHeight = max(1f, boundsOpts.outHeight.toFloat())

            val inputImage = InputImage.fromFilePath(
                reactApplicationContext,
                Uri.fromFile(cleanFile)
            )

            val textRecognizer = TextRecognition.getClient(
                TextRecognizerOptions.DEFAULT_OPTIONS
            )
            val barcodeScanner = BarcodeScanning.getClient()

            textRecognizer.process(inputImage)
                .addOnSuccessListener { visionText ->
                    barcodeScanner.process(inputImage)
                        .addOnSuccessListener { barcodes ->
                            val blocksArray = Arguments.createArray()
                            for (block in visionText.textBlocks) {
                                val rect = block.boundingBox ?: continue
                                val blockMap = Arguments.createMap()
                                blockMap.putString("text", block.text)
                                blockMap.putDouble("confidence", 0.92)

                                val rawBox = Arguments.createMap().apply {
                                    putDouble("x", rect.left.toDouble())
                                    putDouble("y", rect.top.toDouble())
                                    putDouble("width", rect.width().toDouble())
                                    putDouble("height", rect.height().toDouble())
                                }
                                val normBox = Arguments.createMap().apply {
                                    putDouble("x", (rect.left / imgWidth).toDouble())
                                    putDouble("y", (rect.top / imgHeight).toDouble())
                                    putDouble("width", (rect.width() / imgWidth).toDouble())
                                    putDouble("height", (rect.height() / imgHeight).toDouble())
                                }
                                blockMap.putMap("boundingBox", rawBox)
                                blockMap.putMap("normalizedBox", normBox)
                                blocksArray.pushMap(blockMap)
                            }

                            val barcodeArray = Arguments.createArray()
                            for (barcode in barcodes) {
                                val rawVal = barcode.rawValue
                                if (!rawVal.isNullOrBlank()) {
                                    barcodeArray.pushString(rawVal)
                                }
                            }

                            val result = Arguments.createMap().apply {
                                putString("fullText", visionText.text)
                                putArray("blocks", blocksArray)
                                putArray("detectedBarcodes", barcodeArray)
                            }
                            textRecognizer.close()
                            barcodeScanner.close()
                            promise.resolve(result)
                        }
                        .addOnFailureListener {
                            val fallbackBarcodes = Arguments.createArray()
                            val result = Arguments.createMap().apply {
                                putString("fullText", visionText.text)
                                putArray("blocks", Arguments.createArray())
                                putArray("detectedBarcodes", fallbackBarcodes)
                            }
                            textRecognizer.close()
                            barcodeScanner.close()
                            promise.resolve(result)
                        }
                }
                .addOnFailureListener { err ->
                    textRecognizer.close()
                    barcodeScanner.close()
                    promise.reject("OCR_FAILED", err.message, err)
                }
        } catch (err: Throwable) {
            promise.reject("OCR_EXCEPTION", err.message, err)
        }
    }
}

