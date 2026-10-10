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
 * Not compiled into an app. There is no android/ tree until `expo prebuild`,
 * and patch-android-native.sh was not run. The I420 conversion is
 * I420Rgb.sampleSquare, which I420RgbTest runs on a desktop JVM. This
 * wrapper's copy of the WebRTC planes has not been checked on a device.
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
     * Upright square RGB. The math lives in [I420Rgb], which a JVM test
     * runs without the Android SDK. This wrapper only copies the three
     * planes. It has not been compared to a camera frame.
     */
    fun sampleRgb(i420: VideoFrame.I420Buffer, rotation: Int, edge: Int): ByteArray {
      val yBuf = i420.dataY.duplicate()
      val uBuf = i420.dataU.duplicate()
      val vBuf = i420.dataV.duplicate()
      return I420Rgb.sampleSquare(
        y = planeBytes(yBuf),
        u = planeBytes(uBuf),
        v = planeBytes(vBuf),
        srcW = i420.width,
        srcH = i420.height,
        yStride = i420.strideY,
        uStride = i420.strideU,
        vStride = i420.strideV,
        rotation = rotation,
        edge = edge,
        yBase = yBuf.position(),
        uBase = uBuf.position(),
        vBase = vBuf.position(),
      )
    }

    private fun planeBytes(buf: ByteBuffer): ByteArray {
      val dup = buf.duplicate()
      val out = ByteArray(dup.limit())
      dup.position(0)
      dup.get(out)
      return out
    }
  }
}
