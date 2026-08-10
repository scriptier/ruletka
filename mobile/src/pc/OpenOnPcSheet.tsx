import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useT } from "../i18n";
import { hapticLight } from "../feedback/haptics";

/**
 * Phase 1 "Open on PC" — hub URL + friend deep link + share.
 * No claim ticket / match transfer yet (see docs/OPEN_ON_PC_QR.md).
 */
export default function OpenOnPcSheet(props: {
  visible: boolean;
  onClose: () => void;
  url: string;
  code?: string;
}) {
  const { visible, onClose, url, code } = props;
  const t = useT();
  const [copied, setCopied] = useState<"url" | "code" | "deep" | null>(null);

  // Deep link so PC lands with friend code prefilled (add-me path)
  const deepUrl = code
    ? `${url.replace(/\/$/, "")}/live.html?friend=${encodeURIComponent(
        code
      )}&ref=open_pc`
    : `${url.replace(/\/$/, "")}/live.html?ref=open_pc`;

  async function copy(kind: "url" | "code" | "deep", value: string) {
    try {
      await Clipboard.setStringAsync(value);
      hapticLight();
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  }

  async function shareLink() {
    try {
      hapticLight();
      await Share.share({
        message: t("mobile.openOnPc.shareBody", {
          url: deepUrl,
          code: code || "…",
        }) || `Open ruletka on PC: ${deepUrl}`,
        title: t("mobile.openOnPc.title") || "Open on PC",
      });
    } catch {
      /* cancel */
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{t("mobile.openOnPc.title")}</Text>
          <Text style={styles.hint}>{t("mobile.openOnPc.hint")}</Text>

          <Text style={styles.fieldLabel}>
            {t("mobile.openOnPc.deepLabel") || "PC link (with your code)"}
          </Text>
          <Pressable
            style={styles.valueRow}
            onPress={() => copy("deep", deepUrl)}
          >
            <Text style={styles.valueText} numberOfLines={2}>
              {deepUrl}
            </Text>
            <Text style={styles.copyBtn}>
              {copied === "deep"
                ? t("mobile.openOnPc.copied")
                : t("mobile.openOnPc.copyLink")}
            </Text>
          </Pressable>

          <Text style={styles.fieldLabel}>{t("mobile.openOnPc.urlLabel")}</Text>
          <Pressable
            style={styles.valueRow}
            onPress={() => copy("url", url)}
          >
            <Text style={styles.valueText} numberOfLines={1}>
              {url}
            </Text>
            <Text style={styles.copyBtn}>
              {copied === "url"
                ? t("mobile.openOnPc.copied")
                : t("mobile.openOnPc.copyLink")}
            </Text>
          </Pressable>

          {code ? (
            <>
              <Text style={styles.fieldLabel}>
                {t("mobile.openOnPc.codeLabel")}
              </Text>
              <Pressable
                style={styles.valueRow}
                onPress={() => copy("code", code)}
              >
                <Text style={styles.valueText} numberOfLines={1}>
                  {code}
                </Text>
                <Text style={styles.copyBtn}>
                  {copied === "code"
                    ? t("mobile.openOnPc.copied")
                    : t("mobile.openOnPc.copyCode")}
                </Text>
              </Pressable>
            </>
          ) : null}

          <Pressable style={styles.shareBtn} onPress={() => void shareLink()}>
            <Text style={styles.shareBtnText}>
              {t("mobile.openOnPc.share") || "Share link"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.openBtn}
            onPress={() => {
              void Linking.openURL(deepUrl).catch(() => {});
            }}
          >
            <Text style={styles.openBtnText}>
              {t("mobile.openOnPc.openBrowser") || "Open in browser"}
            </Text>
          </Pressable>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t("mobile.openOnPc.close")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#12161f",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 32,
    gap: 8,
  },
  title: { color: "#e8eef7", fontWeight: "800", fontSize: 18 },
  hint: { color: "#6b7a90", fontSize: 12, lineHeight: 17, marginBottom: 8 },
  fieldLabel: {
    color: "#c5d0e0",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 6,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  valueText: { color: "#c5d0e0", fontWeight: "600", fontSize: 14, flex: 1 },
  copyBtn: { color: "#9ec5ff", fontWeight: "700", fontSize: 13 },
  shareBtn: {
    marginTop: 12,
    backgroundColor: "#3d7eff",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  shareBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  openBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(100,160,255,0.45)",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  openBtnText: { color: "#9ec5ff", fontWeight: "700", fontSize: 14 },
  closeBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  closeBtnText: { color: "#c5d0e0", fontWeight: "600" },
});
