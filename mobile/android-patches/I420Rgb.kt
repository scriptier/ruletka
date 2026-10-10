package me.ruletka.app

/**
 * I420 → upright square RGB. No Android or WebRTC types, so a desktop
 * kotlinc can run [I420RgbTest] without prebuild.
 *
 * rotation is the clockwise degrees WebRTC reports. 90 and 270 swap the
 * source width and height before the square sample. YUV is limited-range
 * BT.601. Chroma is subsampled 2×2. Out-of-range plane indexes read as 0.
 */
object I420Rgb {
  fun sampleSquare(
    y: ByteArray,
    u: ByteArray,
    v: ByteArray,
    srcW: Int,
    srcH: Int,
    yStride: Int,
    uStride: Int,
    vStride: Int,
    rotation: Int,
    edge: Int,
    yBase: Int = 0,
    uBase: Int = 0,
    vBase: Int = 0,
  ): ByteArray {
    val rot = ((rotation % 360) + 360) % 360
    val upW = if (rot == 90 || rot == 270) srcH else srcW
    val upH = if (rot == 90 || rot == 270) srcW else srcH
    val out = ByteArray(edge * edge * 3)
    for (dy in 0 until edge) {
      val uy = ((dy + 0.5f) * upH / edge).toInt().coerceIn(0, upH - 1)
      for (dx in 0 until edge) {
        val ux = ((dx + 0.5f) * upW / edge).toInt().coerceIn(0, upW - 1)
        val (sx, sy) = bufferPoint(rot, ux, uy, srcW, srcH)
        val yv = byteAt(y, yBase + sy * yStride + sx)
        val uv = byteAt(u, uBase + (sy / 2) * uStride + (sx / 2))
        val vv = byteAt(v, vBase + (sy / 2) * vStride + (sx / 2))
        val c = yv - 16
        val d = uv - 128
        val e = vv - 128
        val di = (dy * edge + dx) * 3
        out[di] = clampByte((298 * c + 409 * e + 128) shr 8)
        out[di + 1] = clampByte((298 * c - 100 * d - 208 * e + 128) shr 8)
        out[di + 2] = clampByte((298 * c + 516 * d + 128) shr 8)
      }
    }
    return out
  }

  internal fun bufferPoint(rot: Int, ux: Int, uy: Int, srcW: Int, srcH: Int): Pair<Int, Int> {
    val (bx, by) = when (rot) {
      90 -> uy to (srcH - 1 - ux)
      180 -> (srcW - 1 - ux) to (srcH - 1 - uy)
      270 -> (srcW - 1 - uy) to ux
      else -> ux to uy
    }
    return bx.coerceIn(0, srcW - 1) to by.coerceIn(0, srcH - 1)
  }

  private fun byteAt(plane: ByteArray, index: Int): Int {
    if (index < 0 || index >= plane.size) return 0
    return plane[index].toInt() and 0xff
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
