package com.skan.pdf

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min

class PdfGeneratorModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PdfGeneratorModule"

    @ReactMethod
    fun generateSearchablePdf(options: ReadableMap, promise: Promise) {
        Thread {
            val pdfDocument = PdfDocument()
            try {
                val outputFilePath = options.getString("outputFilePath")
                    ?: throw IllegalArgumentException("Missing outputFilePath")
                val jpegQuality = if (options.hasKey("jpegQuality")) {
                    options.getInt("jpegQuality")
                } else {
                    85
                }
                val pagesArray = options.getArray("pages")
                    ?: throw IllegalArgumentException("Missing pages array")

                val pageWidthPt = 595
                val pageHeightPt = 842
                val maxDecodeWidth = 2480
                val maxDecodeHeight = 3508

                val imagePaint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
                val invisibleTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.TRANSPARENT
                    alpha = 0
                }

                for (index in 0 until pagesArray.size()) {
                    val pageMap = pagesArray.getMap(index) ?: continue
                    val filePath = pageMap.getString("filePath") ?: continue
                    val ocrBlocks = pageMap.getArray("ocrBlocks")

                    val pageInfo = PdfDocument.PageInfo.Builder(
                        pageWidthPt,
                        pageHeightPt,
                        index + 1
                    ).create()
                    val pdfPage = pdfDocument.startPage(pageInfo)
                    val canvas = pdfPage.canvas
                    canvas.drawColor(Color.WHITE)

                    var decodedBitmap: Bitmap? = null
                    var compressedBitmap: Bitmap? = null
                    try {
                        decodedBitmap = decodeSampledBitmap(
                            filePath,
                            maxDecodeWidth,
                            maxDecodeHeight
                        )
                        if (decodedBitmap != null) {
                            compressedBitmap = recompressBitmapJpeg(decodedBitmap, jpegQuality)
                            val activeBitmap = compressedBitmap ?: decodedBitmap
                            val destRect = computeAspectFitRect(
                                activeBitmap.width.toFloat(),
                                activeBitmap.height.toFloat(),
                                pageWidthPt.toFloat(),
                                pageHeightPt.toFloat()
                            )
                            canvas.drawBitmap(activeBitmap, null, destRect, imagePaint)

                            if (ocrBlocks != null) {
                                for (bIdx in 0 until ocrBlocks.size()) {
                                    val block = ocrBlocks.getMap(bIdx) ?: continue
                                    val text = block.getString("text") ?: continue
                                    val normBox = block.getMap("normalizedBox") ?: continue
                                    val nx = normBox.getDouble("x").toFloat()
                                    val ny = normBox.getDouble("y").toFloat()
                                    val nh = max(0.012f, normBox.getDouble("height").toFloat())

                                    val drawX = destRect.left + nx * destRect.width()
                                    val drawY = destRect.top + (ny + nh) * destRect.height()
                                    invisibleTextPaint.textSize = max(6f, nh * destRect.height())
                                    canvas.drawText(text, drawX, drawY, invisibleTextPaint)
                                }
                            }
                        }
                    } finally {
                        pdfDocument.finishPage(pdfPage)
                        if (compressedBitmap != null && !compressedBitmap.isRecycled) {
                            compressedBitmap.recycle()
                        }
                        if (decodedBitmap != null && !decodedBitmap.isRecycled) {
                            decodedBitmap.recycle()
                        }
                    }
                }

                val outFile = File(outputFilePath)
                outFile.parentFile?.mkdirs()
                FileOutputStream(outFile).use { stream ->
                    pdfDocument.writeTo(stream)
                }

                val response = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("pdfPath", outFile.absolutePath)
                    putInt("pageCount", pagesArray.size())
                    putDouble("fileSizeBytes", outFile.length().toDouble())
                }
                promise.resolve(response)
            } catch (err: Throwable) {
                promise.reject("PDF_GEN_ERROR", err.message, err)
            } finally {
                pdfDocument.close()
            }
        }.start()
    }

    private fun decodeSampledBitmap(
        filePath: String,
        reqWidth: Int,
        reqHeight: Int
    ): Bitmap? {
        val boundsOptions = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeFile(filePath, boundsOptions)

        var sampleSize = 1
        val halfHeight = boundsOptions.outHeight / 2
        val halfWidth = boundsOptions.outWidth / 2
        while (halfHeight / sampleSize >= reqHeight && halfWidth / sampleSize >= reqWidth) {
            sampleSize *= 2
        }

        val decodeOptions = BitmapFactory.Options().apply {
            inSampleSize = sampleSize
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        return BitmapFactory.decodeFile(filePath, decodeOptions)
    }

    private fun recompressBitmapJpeg(source: Bitmap, quality: Int): Bitmap? {
        val stream = ByteArrayOutputStream()
        val clampedQuality = min(100, max(40, quality))
        source.compress(Bitmap.CompressFormat.JPEG, clampedQuality, stream)
        val byteArray = stream.toByteArray()
        return BitmapFactory.decodeByteArray(byteArray, 0, byteArray.size)
    }

    private fun computeAspectFitRect(
        srcWidth: Float,
        srcHeight: Float,
        dstWidth: Float,
        dstHeight: Float
    ): RectF {
        if (srcWidth <= 0f || srcHeight <= 0f) {
            return RectF(0f, 0f, dstWidth, dstHeight)
        }
        val scale = min(dstWidth / srcWidth, dstHeight / srcHeight)
        val scaledWidth = srcWidth * scale
        val scaledHeight = srcHeight * scale
        val left = (dstWidth - scaledWidth) * 0.5f
        val top = (dstHeight - scaledHeight) * 0.5f
        return RectF(left, top, left + scaledWidth, top + scaledHeight)
    }
}

