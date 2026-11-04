package com.oney.WebRTCModule;

import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

/**
 * View manager for {@link SoftBlurVideoView}.
 *
 * JS: {@code requireNativeComponent('SoftBlurVideoView')}
 * Props: {@code streamURL} (string), {@code active} (boolean).
 */
public class SoftBlurVideoViewManager extends SimpleViewManager<SoftBlurVideoView> {
    public static final String REACT_CLASS = "SoftBlurVideoView";

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    public SoftBlurVideoView createViewInstance(ThemedReactContext context) {
        return new SoftBlurVideoView(context);
    }

    /**
     * Same react-native-webrtc MediaStream.toURL() string used by RTCView.
     * Native resolves via {@link WebRTCModule#getStreamForReactTag(String)}.
     */
    @ReactProp(name = "streamURL")
    public void setStreamURL(SoftBlurVideoView view, String streamURL) {
        view.setStreamURL(streamURL);
    }

    /**
     * When true, attach VideoSink and paint soft blur; when false, detach and clear.
     */
    @ReactProp(name = "active", defaultBoolean = false)
    public void setActive(SoftBlurVideoView view, boolean active) {
        view.setActive(active);
    }
}
