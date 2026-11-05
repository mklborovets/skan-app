package com.skan.frameprocessor

import android.graphics.ImageFormat
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import java.nio.ByteBuffer

class SkanEdgeFrameProcessorPlugin(
    proxy: VisionCameraProxy,
    options: Map<String, Any>?
) : FrameProcessorPlugin() {

    companion object {
        init {
            System.loadLibrary("skan_opencv")
        }
    }

    private external fun nativeDetectEdgesFromYPlane(
        yByteBuffer: ByteBuffer,
        width: Int,
        height: Int,
        rowStride: Int
    ): FloatArray?

    external fun nativeInstallJsi(jsiRuntimePtr: Long)

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        val mediaImage = frame.image ?: return null
        if (mediaImage.format != ImageFormat.YUV_420_888 || mediaImage.planes.isEmpty()) {
            return null
        }

        val yPlane = mediaImage.planes[0]
        val yBuffer = yPlane.buffer
        if (!yBuffer.isDirect) {
            return null
        }

        val rawResult = nativeDetectEdgesFromYPlane(
            yBuffer,
            frame.width,
            frame.height,
            yPlane.rowStride
        ) ?: return mapOf("skipped" to true)

        if (rawResult.size < 13) {
            return mapOf("skipped" to true)
        }

        val detected = rawResult[0] > 0.5f
        return mapOf(
            "skipped" to false,
            "detected" to detected,
            "tlX" to rawResult[1].toDouble(),
            "tlY" to rawResult[2].toDouble(),
            "trX" to rawResult[3].toDouble(),
            "trY" to rawResult[4].toDouble(),
            "brX" to rawResult[5].toDouble(),
            "brY" to rawResult[6].toDouble(),
            "blX" to rawResult[7].toDouble(),
            "blY" to rawResult[8].toDouble(),
            "confidence" to rawResult[9].toDouble(),
            "areaRatio" to rawResult[10].toDouble(),
            "frameWidth" to rawResult[11].toDouble(),
            "frameHeight" to rawResult[12].toDouble()
        )
    }
}
