package com.oney.WebRTCModule;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RenderEffect;
import android.graphics.Shader;
import android.os.Build;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;

import com.facebook.react.bridge.ReactContext;

import org.webrtc.MediaStream;
import org.webrtc.VideoFrame;
import org.webrtc.VideoSink;
import org.webrtc.VideoTrack;

import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Soft live-blur of a remote WebRTC stream (PC drawSoftBlurredVideo parity).
 *
 * Samples VideoTrack frames via {@link VideoSink}, downscales to ~48px wide,
 * scales up with bilinear filtering (heavy blur feel), optional slight dim,
 * paints into an ImageView. Throttled to ~12 fps. Package
 * {@code com.oney.WebRTCModule} so package-private
 * {@link WebRTCModule#getStreamForReactTag(String)} is accessible (same as
 * {@link WebRTCView}).
 */
public class SoftBlurVideoView extends FrameLayout implements VideoSink {
    private static final String TAG = "SoftBlurVideoView";

    /** ~12 fps throttle (PC soft-blur is rAF but we keep CPU light). */
    private static final long MIN_FRAME_INTERVAL_NS = 1_000_000_000L / 12;

    /** Tiny intermediate width — matches PC drawSoftBlurredVideo tinyW=48. */
    private static final int TINY_WIDTH = 48;

    /** Dim overlay ~ rgba(10,12,18,0.18) so it reads as privacy blur. */
    private static final int DIM_COLOR = Color.argb(46, 10, 12, 18);

    private static final int SLATE = Color.parseColor("#1c2230");
    private static final int SLATE_DARK = Color.parseColor("#12161e");

    private final ImageView imageView;
    private final ExecutorService convertExecutor =
            Executors.newSingleThreadExecutor(r -> {
                Thread t = new Thread(r, "SoftBlurConvert");
                t.setPriority(Thread.NORM_PRIORITY - 1);
                t.setDaemon(true);
                return t;
            });

    private final AtomicBoolean frameInFlight = new AtomicBoolean(false);
    private final Object trackLock = new Object();

    private String streamURL;
    private boolean active;
    private VideoTrack videoTrack;
    private boolean sinkAttached;
    private long lastAcceptedFrameNs;
    private volatile int targetOutW = 360;
    private volatile int targetOutH = 640;

    private final Paint filterPaint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
    private final Paint dimPaint = new Paint();

    public SoftBlurVideoView(Context context) {
        super(context);
        setBackgroundColor(SLATE);

        imageView = new ImageView(context);
        imageView.setScaleType(ImageView.ScaleType.CENTER_CROP);
        imageView.setLayoutParams(new LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        // Soft slate while waiting for first blurred frame
        imageView.setBackgroundColor(SLATE);
        addView(imageView);

        dimPaint.setColor(DIM_COLOR);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Optional extra frost on top of downscale-blur (API 31+)
            try {
                imageView.setRenderEffect(
                        RenderEffect.createBlurEffect(4f, 4f, Shader.TileMode.CLAMP));
            } catch (Throwable ignored) {
                // RenderEffect optional
            }
        }
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        if (w > 0 && h > 0) {
            // Cap output bitmap to modest size for CPU (PC uses ~360 wide)
            int outW = Math.min(w, 480);
            int outH = Math.max(1, Math.round(h * (outW / (float) w)));
            targetOutW = outW;
            targetOutH = outH;
        }
    }

    public void setStreamURL(String streamURL) {
        String next = streamURL;
        if (next != null && next.isEmpty()) {
            next = null;
        }
        if ((this.streamURL == null && next == null)
                || (this.streamURL != null && this.streamURL.equals(next))) {
            return;
        }
        this.streamURL = next;
        rebindIfNeeded();
    }

    public void setActive(boolean active) {
        if (this.active == active) {
            return;
        }
        this.active = active;
        if (!active) {
            // Keep VideoSink + last frame ~400ms so intro peel does not
            // flash empty navy while RTCView starts (390: face 3s then gone).
            postDelayed(
                () -> {
                    if (this.active) return;
                    imageView.setImageBitmap(null);
                    imageView.setBackgroundColor(Color.TRANSPARENT);
                    setBackgroundColor(Color.TRANSPARENT);
                    setVisibility(INVISIBLE);
                },
                400);
            return;
        }
        post(() -> setVisibility(VISIBLE));
        rebindIfNeeded();
    }

    private void rebindIfNeeded() {
        if (streamURL == null) {
            detachSink();
            return;
        }
        if (!active) {
            return;
        }
        if (!isAttachedToWindow()) {
            return;
        }
        resolveAndAttach();
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        rebindIfNeeded();
    }

    /**
     * Resolve streamURL → MediaStream → VideoTrack on WebRTC executor,
     * then add this as a VideoSink (same pattern as {@link WebRTCView}).
     */
    private void resolveAndAttach() {
        final String url = streamURL;
        if (url == null || !active) {
            return;
        }

        final ReactContext reactContext;
        try {
            reactContext = (ReactContext) getContext();
        } catch (ClassCastException e) {
            Log.w(TAG, "Context is not ReactContext");
            return;
        }

        final WebRTCModule module = reactContext.getNativeModule(WebRTCModule.class);
        if (module == null) {
            Log.w(TAG, "WebRTCModule not found");
            return;
        }

        ThreadUtils.runOnExecutor(() -> {
            try {
                MediaStream stream = module.getStreamForReactTag(url);
                if (stream == null) {
                    Log.w(TAG, "Stream not found for URL: " + url);
                    synchronized (trackLock) {
                        if (url.equals(streamURL)) {
                            detachSinkLocked();
                        }
                    }
                    return;
                }

                VideoTrack track = null;
                List<VideoTrack> videoTracks = stream.videoTracks;
                if (videoTracks != null && !videoTracks.isEmpty()) {
                    track = videoTracks.get(0);
                }
                if (track == null) {
                    Log.w(TAG, "No video track for react tag: " + url);
                    return;
                }

                final VideoTrack resolved = track;
                synchronized (trackLock) {
                    if (!active || streamURL == null || !url.equals(streamURL)) {
                        return;
                    }
                    if (sinkAttached && videoTrack == resolved) {
                        return;
                    }
                    detachSinkLocked();
                    try {
                        resolved.addSink(SoftBlurVideoView.this);
                        videoTrack = resolved;
                        sinkAttached = true;
                        Log.d(TAG, "Sink attached for " + url);
                    } catch (Throwable tr) {
                        Log.e(TAG, "addSink failed", tr);
                        videoTrack = null;
                        sinkAttached = false;
                    }
                }
            } catch (Throwable tr) {
                Log.e(TAG, "Error resolving stream URL: " + url, tr);
            }
        });
    }

    private void detachSink() {
        try {
            ThreadUtils.runOnExecutor(() -> {
                synchronized (trackLock) {
                    detachSinkLocked();
                }
            });
        } catch (Throwable tr) {
            // Fallback if executor busy/dying
            synchronized (trackLock) {
                detachSinkLocked();
            }
        }
    }

    /** Release convert pool when view is gone (avoids late onFrame after dispose). */
    @Override
    protected void onDetachedFromWindow() {
        detachSink();
        try {
            if (!convertExecutor.isShutdown()) {
                convertExecutor.shutdownNow();
            }
        } catch (Throwable ignored) {
        }
        super.onDetachedFromWindow();
    }

    /** Caller must hold {@link #trackLock}. */
    private void detachSinkLocked() {
        if (sinkAttached && videoTrack != null) {
            try {
                videoTrack.removeSink(this);
            } catch (Throwable tr) {
                // Track may already be disposed (mediaStreamTrackRelease)
            }
        }
        videoTrack = null;
        sinkAttached = false;
        frameInFlight.set(false);
    }

    private void clearImage() {
        post(() -> {
            imageView.setImageBitmap(null);
            imageView.setBackgroundColor(SLATE);
        });
    }

    @Override
    public void onFrame(VideoFrame frame) {
        // Crash guard: track may fire after detach / during PC teardown.
        if (frame == null || convertExecutor.isShutdown()) {
            return;
        }
        if (!active || !sinkAttached) {
            return;
        }

        long now = System.nanoTime();
        if (now - lastAcceptedFrameNs < MIN_FRAME_INTERVAL_NS) {
            return;
        }
        if (!frameInFlight.compareAndSet(false, true)) {
            // Previous convert still running — drop frame (CPU light)
            return;
        }
        lastAcceptedFrameNs = now;

        // Retain for async convert; release in finally on convert thread.
        // retain() can throw if the frame/buffer was already released by WebRTC.
        try {
            frame.retain();
        } catch (Throwable tr) {
            frameInFlight.set(false);
            return;
        }
        final int outW = Math.max(1, targetOutW);
        final int outH = Math.max(1, targetOutH);

        try {
        convertExecutor.execute(() -> {
            Bitmap out = null;
            VideoFrame.I420Buffer i420 = null;
            boolean postedToUi = false;
            try {
                VideoFrame.Buffer buffer = frame.getBuffer();
                if (buffer == null) {
                    return;
                }
                i420 = buffer.toI420();
                if (i420 == null) {
                    return;
                }

                int srcW = i420.getWidth();
                int srcH = i420.getHeight();
                if (srcW <= 0 || srcH <= 0) {
                    return;
                }

                int rotation = frame.getRotation();
                int rotW = frame.getRotatedWidth();
                int rotH = frame.getRotatedHeight();
                if (rotW <= 0 || rotH <= 0) {
                    rotW = srcW;
                    rotH = srcH;
                }

                int tinyW = TINY_WIDTH;
                int tinyH = Math.max(1, Math.round(rotH * (tinyW / (float) rotW)));

                Bitmap tiny = i420ToTinyBitmap(i420, srcW, srcH, tinyW, tinyH, rotation);
                if (tiny == null) {
                    return;
                }

                // Scale up with FILTER_BILINEAR — heavy soft-blur feel
                out = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(out);
                canvas.drawColor(SLATE_DARK);
                Matrix m = new Matrix();
                float scale = Math.max(outW / (float) tiny.getWidth(), outH / (float) tiny.getHeight());
                float dx = (outW - tiny.getWidth() * scale) * 0.5f;
                float dy = (outH - tiny.getHeight() * scale) * 0.5f;
                m.setScale(scale, scale);
                m.postTranslate(dx, dy);
                canvas.drawBitmap(tiny, m, filterPaint);
                tiny.recycle();

                // Slight dim so it reads as privacy blur (PC parity)
                canvas.drawRect(0, 0, outW, outH, dimPaint);

                final Bitmap toShow = out;
                out = null; // ownership transferred to UI
                postedToUi = true;
                post(() -> {
                    try {
                        if (active) {
                            imageView.setBackgroundColor(Color.TRANSPARENT);
                            imageView.setImageBitmap(toShow);
                        } else {
                            toShow.recycle();
                        }
                    } catch (Throwable tr) {
                        try {
                            toShow.recycle();
                        } catch (Throwable ignored) {
                        }
                    } finally {
                        frameInFlight.set(false);
                    }
                });
            } catch (Throwable tr) {
                Log.e(TAG, "onFrame convert failed", tr);
            } finally {
                if (i420 != null) {
                    try {
                        i420.release();
                    } catch (Throwable ignored) {
                    }
                }
                try {
                    frame.release();
                } catch (Throwable ignored) {
                }
                if (out != null) {
                    try {
                        out.recycle();
                    } catch (Throwable ignored) {
                    }
                }
                if (!postedToUi) {
                    frameInFlight.set(false);
                }
            }
        });
        } catch (Throwable tr) {
            // Executor rejected (shutdown) after retain — drop frame cleanly
            frameInFlight.set(false);
            try {
                frame.release();
            } catch (Throwable ignored) {
            }
            Log.w(TAG, "onFrame schedule failed", tr);
        }
    }

    /**
     * Sample I420 into a tiny ARGB bitmap. Applies rotation in 90° steps by
     * mapping output coords back to source so we don't need an extra bitmap.
     */
    private static Bitmap i420ToTinyBitmap(
            VideoFrame.I420Buffer i420,
            int srcW,
            int srcH,
            int tinyW,
            int tinyH,
            int rotation) {
        ByteBuffer yBuf = i420.getDataY();
        ByteBuffer uBuf = i420.getDataU();
        ByteBuffer vBuf = i420.getDataV();
        int strideY = i420.getStrideY();
        int strideU = i420.getStrideU();
        int strideV = i420.getStrideV();

        int rot = ((rotation % 360) + 360) % 360;
        int sampleW = (rot == 90 || rot == 270) ? srcH : srcW;
        int sampleH = (rot == 90 || rot == 270) ? srcW : srcH;

        int[] pixels = new int[tinyW * tinyH];
        for (int ty = 0; ty < tinyH; ty++) {
            int syOut = ty * sampleH / tinyH;
            for (int tx = 0; tx < tinyW; tx++) {
                int sxOut = tx * sampleW / tinyW;
                int sx;
                int sy;
                switch (rot) {
                    case 90:
                        sx = syOut;
                        sy = sampleW - 1 - sxOut;
                        break;
                    case 180:
                        sx = sampleW - 1 - sxOut;
                        sy = sampleH - 1 - syOut;
                        break;
                    case 270:
                        sx = sampleH - 1 - syOut;
                        sy = sxOut;
                        break;
                    default:
                        sx = sxOut;
                        sy = syOut;
                        break;
                }
                if (sx < 0) sx = 0;
                if (sy < 0) sy = 0;
                if (sx >= srcW) sx = srcW - 1;
                if (sy >= srcH) sy = srcH - 1;

                int y = yBuf.get(sy * strideY + sx) & 0xff;
                int uvx = sx >> 1;
                int uvy = sy >> 1;
                int u = uBuf.get(uvy * strideU + uvx) & 0xff;
                int v = vBuf.get(uvy * strideV + uvx) & 0xff;

                // BT.601 limited-range YUV → RGB
                int c = y - 16;
                if (c < 0) c = 0;
                int d = u - 128;
                int e = v - 128;
                int r = (298 * c + 409 * e + 128) >> 8;
                int g = (298 * c - 100 * d - 208 * e + 128) >> 8;
                int b = (298 * c + 516 * d + 128) >> 8;
                r = clamp255(r);
                g = clamp255(g);
                b = clamp255(b);
                pixels[ty * tinyW + tx] = 0xFF000000 | (r << 16) | (g << 8) | b;
            }
        }
        return Bitmap.createBitmap(pixels, tinyW, tinyH, Bitmap.Config.ARGB_8888);
    }

    private static int clamp255(int v) {
        if (v < 0) return 0;
        if (v > 255) return 255;
        return v;
    }
}
