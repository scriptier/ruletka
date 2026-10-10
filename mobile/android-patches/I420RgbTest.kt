package me.ruletka.app

/**
 * JVM check for [I420Rgb]. No Android SDK.
 *
 *   kotlinc I420Rgb.kt I420RgbTest.kt -include-runtime -d /tmp/i420-rgb-test.jar
 *   java -jar /tmp/i420-rgb-test.jar
 *
 * Ran with kotlinc-jvm 2.3.10 from the local Android Studio plugin.
 * expo prebuild and Gradle were not used.
 */
fun main() {
  var failed = 0
  fun check(name: String, ok: Boolean) {
    println("${if (ok) "ok" else "FAIL"}  $name")
    if (!ok) failed += 1
  }

  fun rgb(out: ByteArray, pixel: Int): Triple<Int, Int, Int> {
    val i = pixel * 3
    return Triple(out[i].toInt() and 255, out[i + 1].toInt() and 255, out[i + 2].toInt() and 255)
  }

  // 2×2 luma, neutral chroma. Limited-range Y 16..19 → RGB 0..3.
  val y = byteArrayOf(16, 17, 18, 19)
  val u = byteArrayOf(128.toByte())
  val v = byteArrayOf(128.toByte())

  fun sample(rotation: Int, yPlane: ByteArray = y, yStride: Int = 2, uPlane: ByteArray = u, vPlane: ByteArray = v, uStride: Int = 1, vStride: Int = 1): ByteArray {
    return I420Rgb.sampleSquare(
      y = yPlane,
      u = uPlane,
      v = vPlane,
      srcW = 2,
      srcH = 2,
      yStride = yStride,
      uStride = uStride,
      vStride = vStride,
      rotation = rotation,
      edge = 2,
    )
  }

  fun channels(out: ByteArray): List<Int> = (0 until 4).map { rgb(out, it).first }

  check("rot 0 keeps source order", channels(sample(0)) == listOf(0, 1, 2, 3))
  check("rot 0 channels match", (0 until 4).all { val p = rgb(sample(0), it); p.first == p.second && p.second == p.third })
  check("rot 90", channels(sample(90)) == listOf(2, 0, 3, 1))
  check("rot 180", channels(sample(180)) == listOf(3, 2, 1, 0))
  check("rot 270", channels(sample(270)) == listOf(1, 3, 0, 2))
  check("rot 360 matches 0", channels(sample(360)) == listOf(0, 1, 2, 3))
  check("rot -90 matches 270", channels(sample(-90)) == channels(sample(270)))

  val padded = byteArrayOf(
    16, 17, 255.toByte(), 255.toByte(),
    18, 19, 255.toByte(), 255.toByte(),
  )
  check(
    "y stride padding is not a pixel",
    channels(sample(0, yPlane = padded, yStride = 4, uPlane = byteArrayOf(128.toByte(), 255.toByte()), uStride = 2, vPlane = byteArrayOf(128.toByte(), 9), vStride = 2))
      == listOf(0, 1, 2, 3),
  )

  val chroma = I420Rgb.sampleSquare(
    y = byteArrayOf(126),
    u = byteArrayOf(128.toByte()),
    v = byteArrayOf(178.toByte()),
    srcW = 1,
    srcH = 1,
    yStride = 1,
    uStride = 1,
    vStride = 1,
    rotation = 0,
    edge = 1,
  )
  check("bt601 chroma", rgb(chroma, 0) == Triple(208, 87, 128))

  val lo = I420Rgb.sampleSquare(
    y = byteArrayOf(16),
    u = byteArrayOf(16),
    v = byteArrayOf(16),
    srcW = 1, srcH = 1, yStride = 1, uStride = 1, vStride = 1,
    rotation = 0, edge = 1,
  )
  check("clamp low", rgb(lo, 0) == Triple(0, 135, 0))

  val hi = I420Rgb.sampleSquare(
    y = byteArrayOf(235.toByte()),
    u = byteArrayOf(240.toByte()),
    v = byteArrayOf(240.toByte()),
    srcW = 1, srcH = 1, yStride = 1, uStride = 1, vStride = 1,
    rotation = 0, edge = 1,
  )
  check("clamp high", rgb(hi, 0) == Triple(255, 120, 255))

  if (failed > 0) {
    println("$failed failed")
    kotlin.system.exitProcess(1)
  }
  println("0 failed")
}
