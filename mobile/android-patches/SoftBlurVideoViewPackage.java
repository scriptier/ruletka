package me.ruletka.app;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.oney.WebRTCModule.SoftBlurVideoViewManager;

import java.util.Collections;
import java.util.List;

/** Registers native SoftBlurVideoView (BLUR-F2 soft live blur). */
public class SoftBlurVideoViewPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    @Override
    @SuppressWarnings("rawtypes")
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.<ViewManager>singletonList(new SoftBlurVideoViewManager());
    }
}
