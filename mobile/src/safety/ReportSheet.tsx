/**
 * Report sheet: capture video-stage screenshot + pick a reason, then
 * report + block (caller also skips to Next).
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type ReportReason =
  | "underage"
  | "explicit"
  | "harassment"
  | "hate"
  | "spam"
  | "other";

export const REPORT_REASONS: {
  id: ReportReason;
  labelKey: string;
  fallback: string;
}[] = [
  { id: "underage", labelKey: "mobile.live.reasonUnderage", fallback: "Underage suspicion" },
  { id: "explicit", labelKey: "mobile.live.reasonExplicit", fallback: "Explicit content" },
  { id: "harassment", labelKey: "mobile.live.reasonHarassment", fallback: "Harassment" },
  { id: "hate", labelKey: "mobile.live.reasonHate", fallback: "Hate / threats" },
  { id: "spam", labelKey: "mobile.live.reasonSpam", fallback: "Spam / scam" },
  { id: "other", labelKey: "mobile.live.reasonOther", fallback: "Other" },
];

type Props = {
  visible: boolean;
  partnerLabel: string;
  /** file:// or data URI for preview */
  screenshotUri: string | null;
  capturing: boolean;
  busy: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onCancel: () => void;
  /** @deprecated unused — submit always reports + blocks */
  onBlockOnly?: () => void;
  onSubmit: (reason: ReportReason) => void;
};

export function ReportSheet(props: Props) {
  const {
    visible,
    partnerLabel,
    screenshotUri,
    capturing,
    busy,
    t,
    onCancel,
    onBlockOnly,
    onSubmit,
  } = props;
  const [picked, setPicked] = useState<ReportReason | null>(null);

  useEffect(() => {
    if (visible) setPicked(null);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            {t("mobile.live.reportTitle")}
          </Text>
          <Text style={styles.sub}>
            {t("mobile.live.reportSub", { name: partnerLabel })}
          </Text>

          <View style={styles.shotWrap}>
            {capturing ? (
              <View style={styles.shotPlaceholder}>
                <ActivityIndicator color="#ff2d55" />
                <Text style={styles.shotHint}>{t("mobile.live.reportCapturing")}</Text>
              </View>
            ) : screenshotUri ? (
              <Image
                source={{ uri: screenshotUri }}
                style={styles.shot}
                resizeMode="cover"
                accessible={false}
                importantForAccessibility="no"
              />
            ) : (
              <View style={styles.shotPlaceholder}>
                <Text style={styles.shotHint}>{t("mobile.live.reportNoShot")}</Text>
              </View>
            )}
          </View>

          {/* One-tap explicit (most common troll) — still full report + block + next */}
          <Pressable
            style={[styles.quickExplicit, (busy || capturing) && styles.submitDisabled]}
            disabled={busy || capturing}
            onPress={() => onSubmit("explicit")}
            accessibilityRole="button"
            accessibilityLabel={
              t("mobile.live.reportExplicitQuick") || "Report explicit · block · next"
            }
            accessibilityState={{ disabled: busy || capturing, busy }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.quickExplicitText}>
                {t("mobile.live.reportExplicitQuick") ||
                  "Report explicit · block · next"}
              </Text>
            )}
          </Pressable>

          <Text style={styles.reasonLead}>{t("mobile.live.reportReason")}</Text>
          <Text style={styles.underageTip}>{t("mobile.live.reportUnderageTip")}</Text>
          <View style={styles.reasons}>
            {REPORT_REASONS.map((r) => {
              const label = t(r.labelKey) || r.fallback;
              const on = picked === r.id;
              const urgent = r.id === "underage";
              return (
                <Pressable
                  key={r.id}
                  style={[
                    styles.reasonBtn,
                    urgent && styles.reasonBtnUrgent,
                    on && styles.reasonBtnOn,
                    on && urgent && styles.reasonBtnUrgentOn,
                  ]}
                  disabled={busy}
                  onPress={() => setPicked(r.id)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: on, disabled: busy }}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      urgent && styles.reasonTextUrgent,
                      on && styles.reasonTextOn,
                    ]}
                    importantForAccessibility="no"
                  >
                    {urgent ? `⚠ ${label}` : label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.note}>{t("mobile.live.reportAlsoBlock")}</Text>

          <Pressable
            style={[
              styles.submit,
              (!picked || busy || capturing) && styles.submitDisabled,
            ]}
            disabled={!picked || busy || capturing}
            onPress={() => picked && onSubmit(picked)}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.live.reportSubmit")}
            accessibilityState={{
              disabled: !picked || busy || capturing,
              busy,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText} importantForAccessibility="no">
                {t("mobile.live.reportSubmit")}
              </Text>
            )}
          </Pressable>

          <View style={styles.row}>
            {/* One path only: submit does report + block. Cancel closes sheet. */}
            <Pressable
              style={styles.ghost}
              disabled={busy}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.common.cancel")}
              accessibilityState={{ disabled: busy }}
            >
              <Text style={styles.ghostText} importantForAccessibility="no">
                {t("mobile.common.cancel")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    backgroundColor: "#12151c",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 10,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  sub: { color: "#a8b4c8", fontSize: 14, lineHeight: 20 },
  shotWrap: {
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0a0c10",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  shot: { width: "100%", height: "100%" },
  shotPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shotHint: { color: "#6b778a", fontSize: 13 },
  quickExplicit: {
    backgroundColor: "rgba(255,45,85,0.92)",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  quickExplicitText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  reasonLead: { color: "#e8eef8", fontWeight: "700", marginTop: 4 },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  underageTip: {
    color: "#ffb0bc",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
    fontWeight: "600",
  },
  reasonBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  reasonBtnUrgent: {
    borderColor: "rgba(255,100,120,0.45)",
    backgroundColor: "rgba(80,20,30,0.45)",
  },
  reasonBtnOn: {
    backgroundColor: "rgba(255,45,85,0.22)",
    borderColor: "#ff2d55",
  },
  reasonBtnUrgentOn: {
    backgroundColor: "rgba(255,45,85,0.35)",
    borderColor: "#ff6b7a",
  },
  reasonText: { color: "#c5d0e0", fontSize: 13, fontWeight: "600" },
  reasonTextUrgent: { color: "#ffb0bc" },
  reasonTextOn: { color: "#fff" },
  note: { color: "#8a96a8", fontSize: 12, lineHeight: 17 },
  submit: {
    backgroundColor: "#ff2d55",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  ghost: { paddingVertical: 10, paddingHorizontal: 8 },
  ghostText: { color: "#9aa8bc", fontWeight: "600", fontSize: 13 },
});
