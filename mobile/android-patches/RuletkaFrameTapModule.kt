package me.ruletka.app

import android.os.SystemClock
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.oney.WebRTCModule.WebRTCModule
import org.webrtc.VideoFrame
import org.webrtc.VideoSink
import org.webrtc.VideoTrack
import java.nio.ByteBuffer
import java.util.concurrent.ConcurrentHashMap

/**
 * Copies a downscaled RGB frame from a react-native-webrtc video track.
 *
 * Not compiled. There is no android/ tree until `expo prebuild`, and
 * patch-android-native.sh was not run for this file. Pixel format, stride,
 * and rotation are implemented from the WebRTC Java API and are untested
 * on a device. A wrong frame must not be treated as a face decision in JS
 * if the model rejects the tensor shape; this module only delivers bytes.
 *
 * Local camera tracks use pcId -1 (GetUserMedia). Remote tracks use the
 * PeerConnection id stored on the JS MediaStreamTrack.
 */
@ReactModule(name = RuletkaFrameTapModule.NAME)
class RuletkaFrameTapModule(
  private val ctx: ReactApplicationContext
) : ReactContextBaseJavaModule(ctx) {

  private class Attached(val track: VideoTrack, val sink: VideoSink)

  private val attached = ConcurrentHashMap<String, Attached>()

  override fun getName(): String = NAME

  @ReactMethod
  fun attach(pcId: Double, trackId: String, edge: Double, intervalMs: Double, promise: Promise) {
    try {
      val track = findTrack(pcId.toInt(), trackId)
      if (track !is VideoTrack) {
        promise.reject("NO_TRACK", "video track not found")
        return
      }
      detachTrack(trackId)
      val sink = ThrottledSink(
        ctx,
        trackId,
        edge.toInt().coerceIn(32, 320),
        intervalMs.toLong().coerceIn(500L, 10_000L)
      )
      attached[trackId] = Attached(track, sink)
      track.addSink(sink)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("TAP_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun detach(trackId: String) {
    try {
      detachTrack(trackId)
    } catch (_: Exception) {
      /* track already gone */
    }
  }

  private fun detachTrack(trackId: String) {
    val tap = attached.remove(trackId) ?: return
    tap.track.removeSink(tap.sink)
  }

  private fun findTrack(pcId: Int, trackId: String): org.webrtc.MediaStreamTrack? {
    val webrtc = ctx.getNativeModule(WebRTCModule::class.java) ?: return null
    return webrtc.getTrack(pcId, trackId)
  }

  private class ThrottledSink(
    private val ctx: ReactApplicationContext,
    private val trackId: String,
    private val edge: Int,
    private val intervalMs: Long
  ) : VideoSink {
    private var lastAt = 0L

    override fun onFrame(frame: VideoFrame) {
      val now = SystemClock.elapsedRealtime()
      if (now - lastAt < intervalMs) return
      lastAt = now
      val i420 = frame.buffer.toI420() ?: return
      try {
        val rgb = RuletkaFrameTapModule.sampleRgb(i420, frame.rotation, edge)
        val payload = Arguments.createMap().apply {
          putString("trackId", trackId)
          putInt("width", edge)
          putInt("height", edge)
          putInt("rotation", frame.rotation)
          putString("rgbBase64", Base64.encodeToString(rgb, Base64.NO_WRAP))
        }
        ctx
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT, payload)
      } finally {
        i420.release()
      }
    }
  }

  companion object {
    const val NAME = "RuletkaFrameTap"
    const val EVENT = "RuletkaFrameTap"

    /**
     * Upright square RGB. rotation is the clockwise degrees WebRTC says to
     * apply so the buffer is upright. Untested against a real camera.
     */
    fun sampleRgb(i420: VideoFrame.I420Buffer, rotation: Int, edge: Int): ByteArray {
      val srcW = i420.width
      val srcH = i420.height
      val rot = ((rotation % 360) + 360) % 360
      val upW = if (rot == 90 || rot == 270) srcH else srcW
      val upH = if (rot == 90 || rot == 270) srcW else srcH
      val yBuf = i420.dataY.duplicate()
      val uBuf = i420.dataU.duplicate()
      val vBuf = i420.dataV.duplicate()
      val yBase = yBuf.position()
      val uBase = uBuf.position()
      val vBase = vBuf.position()
      val yStride = i420.strideY
      val uStride = i420.strideU
      val vStride = i420.strideV
      val out = ByteArray(edge * edge * 3)
      for (dy in 0 until edge) {
        val uy = ((dy + 0.5f) * upH / edge).toInt().coerceIn(0, upH - 1)
        for (dx in 0 until edge) {
          val ux = ((dx + 0.5f) * upW / edge).toInt().coerceIn(0, upW - 1)
          val (sx, sy) = bufferPoint(rot, ux, uy, srcW, srcH)
          val y = byteAt(yBuf, yBase + sy * yStride + sx)
          val cx = sx / 2
          val cy = sy / 2
          val u = byteAt(uBuf, uBase + cy * uStride + cx)
          val v = byteAt(vBuf, vBase + cy * vStride + cx)
          val c = y - 16
          val d = u - 128
          val e = v - 128
          val di = (dy * edge + dx) * 3
          out[di] = clampByte((298 * c + 409 * e + 128) shr 8)
          out[di + 1] = clampByte((298 * c - 100 * d - 208 * e + 128) shr 8)
          out[di + 2] = clampByte((298 * c + 516 * d + 128) shr 8)
        }
      }
      return out
    }

    private fun bufferPoint(rot: Int, ux: Int, uy: Int, srcW: Int, srcH: Int): Pair<Int, Int> {
      val (bx, by) = when (rot) {
        90 -> uy to (srcH - 1 - ux)
        180 -> (srcW - 1 - ux) to (srcH - 1 - uy)
        270 -> (srcW - 1 - uy) to ux
        else -> ux to uy
      }
      return bx.coerceIn(0, srcW - 1) to by.coerceIn(0, srcH - 1)
    }

    private fun byteAt(buf: ByteBuffer, index: Int): Int {
      if (index < 0 || index >= buf.limit()) return 0
      return buf.get(index).toInt() and 0xff
    }

    private fun clampByte(v: Int): Byte {
      val n = when {
        v < 0 -> 0
        v > 255 -> 255
        else -> v
      }
      return n.toByte()
    }
  }
}
