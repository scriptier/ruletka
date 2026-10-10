import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { LANG_LABELS, SUPPORTED_LANGS, type LangCode, useI18n } from "./index";

/**
 * Full language list in a scroll sheet. Chip rows in a card with
 * overflow:hidden were clipping long names (Português, Українська).
 */
export function LanguagePickerModal(props: {
  visible: boolean;
  onClose: () => void;
}) {
  const { pref, setPref, lang, t } = useI18n();
  const active = (pref || lang) as LangCode;

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent
      onRequestClose={props.onClose}
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t("mobile.lang")}</Text>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            <Pressable
              style={[styles.row, !pref && styles.rowOn]}
              onPress={() => {
                void setPref("");
                props.onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: !pref }}
            >
              <Text style={styles.rowText}>{t("mobile.lang.system")}</Text>
            </Pressable>
            {SUPPORTED_LANGS.map((code) => (
              <Pressable
                key={code}
                style={[styles.row, pref === code && styles.rowOn]}
                onPress={() => {
                  void setPref(code);
                  props.onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: pref === code }}
              >
                <Text style={styles.rowText} numberOfLines={1}>
                  {LANG_LABELS[code]}
                </Text>
                {active === code ? <Text style={styles.mark}>✓</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            style={styles.close}
            onPress={props.onClose}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.common.cancel")}
          >
            <Text style={styles.closeText}>{t("mobile.common.cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = {
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end" as const,
  },
  sheet: {
    maxHeight: "80%" as const,
    backgroundColor: "#12151c",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800" as const,
    marginBottom: 8,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowOn: { backgroundColor: "rgba(255,45,85,0.12)" },
  rowText: { color: "#e8eef7", fontSize: 16, fontWeight: "600" as const, flex: 1 },
  mark: { color: "#ff8fab", fontSize: 16, fontWeight: "800" as const, marginLeft: 8 },
  close: {
    marginTop: 12,
    alignItems: "center" as const,
    paddingVertical: 12,
  },
  closeText: { color: "#9ec5ff", fontWeight: "700" as const, fontSize: 16 },
};
