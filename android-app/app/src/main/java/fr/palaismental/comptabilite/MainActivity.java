package fr.palaismental.comptabilite;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int REQ_RECORD_AUDIO = 77;
    private static final String LOCAL_ORIGIN = "https://appassets.androidplatform.net";

    private WebView webView;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private SpeechRecognizer recognizer;
    private String pendingSpeechId;
    private String pendingSpeechLang = "fr-FR";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(19, 11, 36));
        getWindow().setNavigationBarColor(Color.rgb(19, 11, 36));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(19, 11, 36));
        setContentView(webView);

        initTts();
        configureWebView();
        webView.loadUrl(LOCAL_ORIGIN + "/assets/www/native.html");
    }

    private void initTts() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                tts.setLanguage(Locale.FRANCE);
                ttsReady = true;
            }
        });
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setTextZoom(100);

        webView.addJavascriptInterface(new TtsBridge(), "AndroidTTS");
        webView.addJavascriptInterface(new SpeechBridge(), "AndroidSpeech");

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !LOCAL_ORIGIN.equals(uri.getScheme() + "://" + uri.getHost());
            }
        });
    }

    public final class TtsBridge {
        @JavascriptInterface
        public void speak(String text, double rate) {
            runOnUiThread(() -> {
                if (!ttsReady || tts == null) return;
                float safeRate = (float) Math.max(0.5, Math.min(2.0, rate));
                tts.setSpeechRate(safeRate);
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "palais-mental");
            });
        }

        @JavascriptInterface
        public void cancel() {
            runOnUiThread(() -> {
                if (tts != null) tts.stop();
            });
        }
    }

    public final class SpeechBridge {
        @JavascriptInterface
        public void start(String callbackId, String lang) {
            runOnUiThread(() -> {
                pendingSpeechId = callbackId;
                pendingSpeechLang = (lang == null || lang.isEmpty()) ? "fr-FR" : lang;
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.RECORD_AUDIO}, REQ_RECORD_AUDIO);
                } else {
                    startOfflineRecognition();
                }
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> {
                if (recognizer != null) recognizer.cancel();
            });
        }
    }

    private void startOfflineRecognition() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sendSpeechError("La reconnaissance vocale hors ligne n'est pas disponible sur ce téléphone.");
            return;
        }
        if (recognizer != null) {
            recognizer.destroy();
        }
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}

            @Override
            public void onError(int error) {
                sendSpeechError("Dictée indisponible hors ligne (code " + error + "). Vérifie que le pack français hors ligne est installé.");
            }

            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String text = (matches == null || matches.isEmpty()) ? "" : matches.get(0);
                sendSpeechResult(text);
            }
        });

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, pendingSpeechLang);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        recognizer.startListening(intent);
    }

    private void sendSpeechResult(String text) {
        final String id = pendingSpeechId == null ? "" : pendingSpeechId;
        final String js = "window.__pmNativeSpeechResult && window.__pmNativeSpeechResult(" +
                JSONObject.quote(id) + "," + JSONObject.quote(text) + ");";
        webView.evaluateJavascript(js, null);
        pendingSpeechId = null;
    }

    private void sendSpeechError(String message) {
        final String id = pendingSpeechId == null ? "" : pendingSpeechId;
        final String js = "window.__pmNativeSpeechError && window.__pmNativeSpeechError(" +
                JSONObject.quote(id) + "," + JSONObject.quote(message) + ");";
        webView.evaluateJavascript(js, null);
        pendingSpeechId = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_RECORD_AUDIO) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startOfflineRecognition();
            } else {
                sendSpeechError("Autorisation micro refusée.");
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (recognizer != null) recognizer.destroy();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
