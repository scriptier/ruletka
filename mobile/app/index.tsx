import Constants from "expo-constants";
import { Link, Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { hapticLight } from "../src/feedback/haptics";
import {
  markWhatsNewSeen,
  shouldShowWhatsNew,
  WHATS_NEW_BULLETS,
} from "../src/boot/whatsNew";
import {
  flagEmoji,
  trustTier,
  trustTierI18nKey,
} from "../src/identity/flagTrust";
import { countUnreadMissed } from "../src/calls/history";
import {
  loadMatchHistory,
  type MatchHistoryEntry,
} from "../src/calls/matchHistory";
import { track } from "../src/analytics/track";
import { hubBase, isFriendsOnly } from "../src/config";
import { loadUnreadMap, totalUnread } from "../src/friends/unread";
import { useHub } from "../src/hub/HubProvider";
import { useT } from "../src/i18n";
import { maybeOfferNotifOptIn } from "../src/push/notifOptIn";
import { useApp } from "./_layout";

function formatMatchAgo(tMs: number, now = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - tMs) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function formatDuration(secs?: number): string {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  if (s <= 0) return "";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function hubHost(): string {
  try {
    return new URL(hubBase()).host || "ruletka.vip";
  } catch {
    return "ruletka.vip";
  }
}

export default function HomeScreen() {
  const { rulesOk } = useApp();
  if (!rulesOk) {
    return <Redirect href="/rules" />;
  }
  // HubProvider only mounts after rules — home body uses useHub safely
  return <HomeBody />;
}

function HomeBody() {
  const { identity } = useApp();
  const {
    stars,
    trustEffective,
    trust,
    connected,
    friends,
    incomingRequests,
    reconnectHub,
    showToast,
    hub,
    poolOnline,
    poolWaiting,
    refreshPool,
  } = useHub();
  const t = useT();
  const friendsOnly = isFriendsOnly();
  const [missed, setMissed] = useState(0);
  const [unreadDmTotal, setUnreadDmTotal] = useState(0);
  const [whatsNew, setWhatsNew] = useState(false);
  const [lastMatch, setLastMatch] = useState<MatchHistoryEntry | null>(null);
  const requestN = incomingRequests.length;
  const friendsBadge = missed + unreadDmTotal + requestN;
  const onlineFriends = friends.filter((f) => f.online).length;
  const trustN = trustEffective || trust;
  /** Busy = 2+ waiting in queue — soft nudge to Start. */
  const poolBusy = poolWaiting >= 2;
  const appVer =
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    "?";
  const buildN =
    Constants.expoConfig?.android?.versionCode ||
    Constants.nativeBuildVersion ||
    "";

  useFocusEffect(
    useCallback(() => {
      countUnreadMissed().then(setMissed).catch(() => setMissed(0));
      loadUnreadMap()
        .then((m) => setUnreadDmTotal(totalUnread(m)))
        .catch(() => setUnreadDmTotal(0));
      shouldShowWhatsNew()
        .then(setWhatsNew)
        .catch(() => setWhatsNew(false));
      loadMatchHistory()
        .then((list) => setLastMatch(list[0] || null))
        .catch(() => setLastMatch(null));
      refreshPool();
    }, [refreshPool])
  );

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => {
          if (friendsOnly) {
            router.push("/friends");
          } else {
            hapticLight();
            // Start chatting → Live already spinning (no second Start tap)
            router.push({ pathname: "/live", params: { autostart: "1" } });
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={t("mobile.home.start")}
      >
        <Text style={styles.brand}>ruletka</Text>
      </Pressable>
      <Text style={styles.tag}>{t("mobile.home.tag")}</Text>
      <Text style={styles.meta}>
        {t("mobile.home.meta", {
          id: identity.user_id.slice(0, 8),
          hub: hubHost(),
          ver: buildN ? `${appVer} (${buildN})` : appVer,
        })}
        {friendsOnly ? ` · ${t("mobile.home.friendsOnlyTag")}` : ""}
      </Text>
      {(() => {
        const hubStatusLine = [
          connected
            ? t("mobile.home.hubOnline")
            : t("mobile.home.hubOfflineTap"),
          `★${stars}`,
          trustN > 0
            ? `${t(trustTierI18nKey(trustN))}${
                trustTier(trustN) !== "new" ? ` ${trustN}` : ` ${trustN}`
              }`
            : "",
          friends.length > 0
            ? t("mobile.home.friendsOnline", {
                n: onlineFriends,
                total: friends.length,
              })
            : "",
          connected && (poolOnline > 0 || poolWaiting > 0)
            ? t("mobile.home.poolLine", {
                online: Math.max(poolOnline, 1),
                wait: poolWaiting,
              })
            : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Pressable
            style={styles.statusRow}
            onPress={() => {
              if (connected) return;
              reconnectHub();
              showToast(t("mobile.settings.hubReconnecting"));
            }}
            onLongPress={() => {
              void Clipboard.setStringAsync(hubBase()).then(() => {
                showToast(t("mobile.home.hubCopied"));
              });
            }}
            delayLongPress={400}
            accessibilityRole="button"
            accessibilityLabel={hubStatusLine}
            accessibilityHint={t("mobile.home.hubCopied")}
            accessibilityState={{ disabled: connected }}
          >
            <View
              style={[
                styles.statusDot,
                connected ? styles.dotOn : styles.dotOff,
              ]}
              importantForAccessibility="no"
            />
            <Text style={styles.statusText} importantForAccessibility="no">
              {hubStatusLine}
            </Text>
          </Pressable>
        );
      })()}

      {/* Friends online — tappable strip (tap → Friends) */}
      {onlineFriends >= 1 ? (
        <Pressable
          style={styles.onlineStrip}
          onPress={() => {
            hapticLight();
            track("funnel_home_friends_online", { n: onlineFriends });
            router.push("/friends");
          }}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.home.friendsOnline", {
            n: onlineFriends,
            total: friends.length,
          })}
        >
          <View style={styles.onlineStripDot} />
          <Text style={styles.onlineStripText}>
            {t("mobile.home.friendsOnline", {
              n: onlineFriends,
              total: friends.length,
            })}
          </Text>
          <Text style={styles.onlineStripChevron}>›</Text>
        </Pressable>
      ) : null}

      {/* Busy pool: nudge Start */}
      {!friendsOnly && connected && poolBusy ? (
        <Pressable
          style={styles.poolBusyCard}
          onPress={() => {
            hapticLight();
            track("funnel_home_pack_live", { via: "pool_busy" });
            router.push({ pathname: "/live", params: { autostart: "1" } });
          }}
        >
          <Text style={styles.poolBusyTitle}>
            {t("mobile.home.poolBusyTitle")}
          </Text>
          <Text style={styles.poolBusyBody}>
            {t("mobile.home.poolBusyBody", {
              n: poolWaiting,
              online: poolOnline,
            })}
          </Text>
          <Text style={styles.poolBusyBtn}>{t("mobile.home.start")}</Text>
        </Pressable>
      ) : null}

      {/* Always show self ★ (spendable) + trust tier chips */}
      <View style={styles.trustRow}>
        <View
          style={[
            styles.trustChip,
            trustTier(trustN) === "senior" && styles.trustSenior,
            trustTier(trustN) === "trusted" && styles.trustTrusted,
            trustTier(trustN) === "known" && styles.trustKnown,
          ]}
        >
          <Text style={styles.trustChipText}>
            {t(trustTierI18nKey(trustN))}
            {trustN > 0 ? ` · ${trustN}` : ""}
          </Text>
        </View>
        <View
          style={[styles.starsChip, stars <= 0 && styles.starsChipZero]}
          accessibilityLabel={`${Math.max(0, stars)} stars`}
        >
          <Text
            style={[
              styles.trustChipText,
              styles.starsChipText,
              stars <= 0 && styles.starsChipTextZero,
            ]}
          >
            ★{Math.max(0, Math.floor(Number(stars) || 0))}
          </Text>
        </View>
      </View>

      {whatsNew ? (
        <View style={styles.whatsNew}>
          <Text style={styles.whatsNewTitle}>
            {t("mobile.whatsNew.title", {
              ver: buildN ? `${appVer} (${buildN})` : appVer,
            })}
          </Text>
          {WHATS_NEW_BULLETS.map((b) => (
            <Text key={b} style={styles.whatsNewBullet}>
              · {t(`mobile.whatsNew.${b}`)}
            </Text>
          ))}
          <Pressable
            style={styles.whatsNewBtn}
            onPress={() => {
              void markWhatsNewSeen();
              setWhatsNew(false);
            }}
          >
            <Text style={styles.whatsNewBtnText}>{t("mobile.whatsNew.ok")}</Text>
          </Pressable>
        </View>
      ) : null}

      {requestN > 0 ? (
        <View style={styles.reqCard}>
          <Text style={styles.reqTitle}>
            {t("mobile.home.requestsTitle", { n: requestN })}
          </Text>
          {incomingRequests.slice(0, 3).map((r) => (
            <View key={r.user_id} style={styles.reqRow}>
              <Text style={styles.reqName} numberOfLines={1}>
                {r.name || r.short_id || r.friend_code || "…"}
              </Text>
              <Pressable
                style={styles.reqAccept}
                onPress={() => {
                  try {
                    hub.acceptFriend(r.user_id);
                    track("funnel_invite_connected", { via: "home_accept" });
                    showToast(t("mobile.friends.accepted"));
                    void maybeOfferNotifOptIn({
                      hub,
                      title: t("mobile.notif.optInTitle"),
                      body: t("mobile.notif.optInBody"),
                      enableLabel: t("mobile.notif.optInEnable"),
                      laterLabel: t("mobile.notif.optInLater"),
                      deniedTitle: t("mobile.notif.optInDeniedTitle"),
                      deniedBody: t("mobile.notif.optInDeniedBody"),
                      openSettingsLabel: t("mobile.notif.optInOpenSettings"),
                      batteryTitle: t("mobile.notif.batteryTitle"),
                      batteryBody: t("mobile.notif.batteryBody"),
                      batteryEnableLabel: t("mobile.notif.batteryEnable"),
                      onEnabled: () =>
                        showToast(t("mobile.notif.optInEnabled")),
                    });
                  } catch (e) {
                    showToast(String(e));
                  }
                }}
              >
                <Text style={styles.reqBtnText}>{t("friends.accept")}</Text>
              </Pressable>
              <Pressable
                style={styles.reqDecline}
                onPress={() => {
                  try {
                    hub.declineFriend(r.user_id);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                <Text style={styles.reqBtnTextMuted}>
                  {t("friends.declineReq")}
                </Text>
              </Pressable>
            </View>
          ))}
          {requestN > 3 ? (
            <Link href="/friends" asChild>
              <Pressable>
                <Text style={styles.reqMore}>
                  {t("mobile.home.requestsMore", { n: requestN - 3 })}
                </Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      ) : null}

      {missed + unreadDmTotal > 0 ? (
        <Link href="/friends" asChild>
          <Pressable style={styles.missedCard}>
            <View style={styles.missedRow}>
              <View style={styles.missedBadge}>
                <Text style={styles.missedBadgeText}>
                  {missed + unreadDmTotal > 9
                    ? "9+"
                    : String(missed + unreadDmTotal)}
                </Text>
              </View>
              <View style={styles.missedCopy}>
                <Text style={styles.missedTitle}>
                  {missed > 0
                    ? t("mobile.home.missedTitle", { n: missed })
                    : t("mobile.home.unreadDmTitle", { n: unreadDmTotal })}
                </Text>
                <Text style={styles.missedBody}>
                  {missed > 0 && unreadDmTotal > 0
                    ? t("mobile.home.missedAndDmBody", {
                        missed,
                        dm: unreadDmTotal,
                      })
                    : missed > 0
                      ? t("mobile.home.missedBody")
                      : t("mobile.home.unreadDmBody")}
                </Text>
              </View>
              <Text style={styles.missedChevron}>›</Text>
            </View>
          </Pressable>
        </Link>
      ) : null}

      {lastMatch && !friendsOnly ? (
        <View style={styles.lastMatchCard}>
          <Pressable
            onPress={() => router.push("/live")}
            onLongPress={() => {
              const code = (lastMatch.friend_code || "").trim();
              if (!code) {
                showToast(t("mobile.home.lastMatchNoCode"));
                return;
              }
              void Clipboard.setStringAsync(code).then(() => {
                showToast(t("mobile.friends.codeCopied"));
              });
            }}
            delayLongPress={380}
          >
            <Text style={styles.lastMatchLabel}>
              {t("mobile.home.lastMatchLabel")}
            </Text>
            <Text style={styles.lastMatchName} numberOfLines={1}>
              {flagEmoji(lastMatch.flag)
                ? `${flagEmoji(lastMatch.flag)} `
                : lastMatch.flag
                  ? `${lastMatch.flag} `
                  : ""}
              {lastMatch.name || "…"}
              {lastMatch.friend_code ? ` · ${lastMatch.friend_code}` : ""}
              {lastMatch.trust
                ? ` · ${t(trustTierI18nKey(lastMatch.trust || 0))}`
                : ""}
            </Text>
            <Text style={styles.lastMatchMeta}>
              {t("mobile.home.lastMatchMeta", {
                ago: formatMatchAgo(lastMatch.t),
                time: formatDuration(lastMatch.duration_secs) || "—",
              })}
            </Text>
          </Pressable>
          <View style={styles.lastMatchActions}>
            {lastMatch.friend_code &&
            !friends.some((f) => f.user_id === lastMatch.user_id) ? (
              <Pressable
                style={styles.lastMatchAct}
                onPress={() => {
                  try {
                    hub.addFriend(lastMatch.friend_code || "");
                    hapticLight();
                    showToast(
                      t("mobile.friends.requestSent", {
                        code: lastMatch.friend_code || "",
                      })
                    );
                  } catch (e) {
                    showToast(String(e));
                  }
                }}
              >
                <Text style={styles.lastMatchActText}>
                  {t("mobile.live.addFriend")}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.lastMatchActGhost}
              onPress={() => router.push("/friends")}
            >
              <Text style={styles.lastMatchActTextMuted}>
                {t("mobile.home.lastMatchMore")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.lastMatchActGhost}
              onPress={() => router.push("/live")}
            >
              <Text style={styles.lastMatchActTextMuted}>
                {t("mobile.nav.live")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {friendsOnly ? (
        <Link href="/friends" asChild>
          <Pressable
            style={styles.cta}
            onPressIn={() => hapticLight()}
            accessibilityRole="button"
            accessibilityLabel={
              friendsBadge > 0
                ? `${t("mobile.home.friends")} (${friendsBadge})`
                : t("mobile.home.friends")
            }
          >
            <Text style={styles.ctaText} importantForAccessibility="no">
              {t("mobile.home.friends")}
              {friendsBadge > 0 ? ` (${friendsBadge})` : ""}
            </Text>
          </Pressable>
        </Link>
      ) : (
        <Link href={{ pathname: "/live", params: { autostart: "1" } }} asChild>
          <Pressable
            style={styles.cta}
            onPressIn={() => hapticLight()}
            accessibilityRole="button"
            accessibilityLabel={t("mobile.home.start")}
          >
            <Text style={styles.ctaText} importantForAccessibility="no">
              {t("mobile.home.start")}
            </Text>
          </Pressable>
        </Link>
      )}

      <Link href={friendsOnly ? "/live" : "/friends"} asChild>
        <Pressable
          style={styles.secondary}
          accessibilityRole="button"
          accessibilityLabel={
            friendsOnly
              ? t("mobile.nav.live")
              : friendsBadge > 0
                ? `${t("mobile.home.friends")} (${friendsBadge})`
                : t("mobile.home.friends")
          }
        >
          <View style={styles.secondaryInner} importantForAccessibility="no">
            <Text style={styles.secondaryText}>
              {friendsOnly ? t("mobile.nav.live") : t("mobile.home.friends")}
            </Text>
            {!friendsOnly && friendsBadge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {friendsBadge > 9 ? "9+" : String(friendsBadge)}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Link>

      <Link href="/settings" asChild>
        <Pressable
          style={styles.secondary}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.home.settings")}
        >
          <Text style={styles.secondaryText} importantForAccessibility="no">
            {t("mobile.home.settings")}
          </Text>
        </Pressable>
      </Link>

      <Text style={styles.note}>
        {friendsOnly
          ? t("mobile.home.friendsOnlyNote")
          : t("mobile.home.note")}
      </Text>
      {!friendsOnly ? (
        <Text style={styles.liveTips}>
          {t("mobile.home.liveTips") ||
            "Live: mute partner · eye = privacy blur · long-press name to copy"}
        </Text>
      ) : null}

      {/* Play store / policy: easy legal links from home */}
      <View style={styles.legalRow}>
        <Pressable
          onPress={() =>
            Linking.openURL(`${hubBase()}/legal/privacy.html`).catch(() => {})
          }
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={t("nav.privacy")}
        >
          <Text style={styles.legalLink} importantForAccessibility="no">
            {t("nav.privacy")}
          </Text>
        </Pressable>
        <Text style={styles.legalDot} importantForAccessibility="no">
          ·
        </Text>
        <Pressable
          onPress={() =>
            Linking.openURL(`${hubBase()}/legal/terms.html`).catch(() => {})
          }
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={t("nav.terms")}
        >
          <Text style={styles.legalLink} importantForAccessibility="no">
            {t("nav.terms")}
          </Text>
        </Pressable>
        <Text style={styles.legalDot} importantForAccessibility="no">
          ·
        </Text>
        <Pressable
          onPress={() =>
            Linking.openURL(`${hubBase()}/legal/child-safety.html`).catch(
              () => {}
            )
          }
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={t("nav.safety")}
        >
          <Text style={styles.legalLink} importantForAccessibility="no">
            {t("nav.safety")}
          </Text>
        </Pressable>
      </View>
      <Pressable
        onLongPress={() => {
          const label = buildN ? `${appVer} (${buildN})` : appVer;
          void Clipboard.setStringAsync(label).then(() => {
            showToast(t("mobile.settings.buildCopied", { build: label }));
            hapticLight();
          });
        }}
        delayLongPress={400}
        accessibilityLabel={`Build ${appVer} ${buildN}`}
        accessibilityHint={t("mobile.settings.buildCopyHint")}
      >
        <Text style={styles.buildBadge}>
          {appVer}
          {buildN ? ` · ${buildN}` : ""}
        </Text>
        <Text style={styles.buildBadgeHint}>
          {t("mobile.settings.buildCopyHint")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 12,
  },
  brand: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tag: { color: "#9aa8bc", fontSize: 15, lineHeight: 22 },
  meta: { color: "#6b7a90", fontSize: 12, marginBottom: 2 },
  liveTips: {
    color: "#7a8ea8",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 2,
    paddingHorizontal: 8,
  },
  buildBadge: {
    alignSelf: "center",
    marginTop: 4,
    color: "#5a6a80",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    fontVariant: ["tabular-nums"],
  },
  buildBadgeHint: {
    alignSelf: "center",
    marginTop: 1,
    color: "#3d4a5c",
    fontSize: 9,
  },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  legalLink: {
    color: "#6b8ab0",
    fontSize: 11,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  legalDot: { color: "#3a4558", fontSize: 11 },
  legalVer: { color: "#4a5568", fontSize: 11, fontWeight: "600" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOn: { backgroundColor: "#3dffa0" },
  dotOff: { backgroundColor: "#ff6b7a" },
  statusText: { color: "#9aa8bc", fontSize: 12, flex: 1, lineHeight: 16 },
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  trustChip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  trustKnown: {
    borderColor: "rgba(100,160,255,0.45)",
    backgroundColor: "rgba(20,36,60,0.55)",
  },
  trustTrusted: {
    borderColor: "rgba(80,220,160,0.5)",
    backgroundColor: "rgba(12,40,32,0.55)",
  },
  trustSenior: {
    borderColor: "rgba(255,180,60,0.6)",
    backgroundColor: "rgba(50,36,8,0.6)",
  },
  starsChip: {
    backgroundColor: "rgba(48, 34, 4, 0.92)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255, 210, 70, 0.85)",
  },
  starsChipZero: {
    backgroundColor: "rgba(28, 24, 10, 0.85)",
    borderColor: "rgba(210, 175, 60, 0.45)",
  },
  starsChipText: { color: "#ffe566" },
  starsChipTextZero: { color: "rgba(255, 228, 140, 0.75)" },
  trustChipText: { color: "#e8eef7", fontSize: 11, fontWeight: "800" },
  codeCard: {
    backgroundColor: "rgba(255,45,85,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,80,100,0.35)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 2,
    marginBottom: 4,
  },
  codeLabel: { color: "#9aa8bc", fontSize: 11, fontWeight: "600" },
  codeValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
  },
  codeHint: { color: "#6b7a90", fontSize: 11, marginTop: 2 },
  reqCard: {
    backgroundColor: "rgba(61,126,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(100,150,255,0.4)",
    borderRadius: 16,
    padding: 12,
    gap: 8,
    marginBottom: 4,
  },
  reqTitle: { color: "#c8dcff", fontWeight: "800", fontSize: 14 },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reqName: { color: "#e8eef7", fontWeight: "700", fontSize: 14, flex: 1 },
  reqAccept: {
    backgroundColor: "#2d9f6f",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  reqDecline: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  reqBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  reqBtnTextMuted: { color: "#9aa8bc", fontWeight: "600", fontSize: 12 },
  reqMore: {
    color: "#9ec5ff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  whatsNew: {
    backgroundColor: "rgba(61,126,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(100,150,255,0.4)",
    borderRadius: 16,
    padding: 14,
    gap: 4,
    marginBottom: 4,
  },
  whatsNewTitle: {
    color: "#c8dcff",
    fontWeight: "800",
    fontSize: 15,
    marginBottom: 4,
  },
  whatsNewBullet: {
    color: "#c8d4e4",
    fontSize: 13,
    lineHeight: 18,
  },
  whatsNewBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#3d7eff",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  whatsNewBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  missedCard: {
    backgroundColor: "rgba(255,45,85,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,80,100,0.45)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 4,
  },
  missedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  missedBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ff2d55",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  missedBadgeText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  missedCopy: { flex: 1, gap: 2 },
  missedTitle: { color: "#ffb0bc", fontWeight: "800", fontSize: 15 },
  missedBody: { color: "#e0c8cc", fontSize: 12, lineHeight: 16 },
  missedChevron: { color: "#ff8fab", fontSize: 28, fontWeight: "300" },
  lastMatchCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
    marginBottom: 4,
  },
  lastMatchLabel: {
    color: "#6b7a90",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  lastMatchName: {
    color: "#e8eef7",
    fontSize: 15,
    fontWeight: "800",
  },
  lastMatchMeta: { color: "#9aa8bc", fontSize: 12, marginTop: 1 },
  lastMatchHint: { color: "#6b7a90", fontSize: 11, marginTop: 4 },
  lastMatchActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  lastMatchAct: {
    backgroundColor: "rgba(45,159,111,0.4)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  lastMatchActGhost: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  lastMatchActText: { color: "#b8f5d4", fontSize: 12, fontWeight: "800" },
  lastMatchActTextMuted: { color: "#c5d0e0", fontSize: 12, fontWeight: "700" },
  cta: {
    backgroundColor: "#ff2d55",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  onlineStrip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "rgba(52,199,89,0.12)",
    borderWidth: 1,
    borderColor: "rgba(52,199,89,0.35)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 10,
  },
  onlineStripDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#34c759",
  },
  onlineStripText: {
    flex: 1,
    color: "#6dffa8",
    fontWeight: "800",
    fontSize: 13,
  },
  onlineStripChevron: {
    color: "#6dffa8",
    fontSize: 20,
    fontWeight: "600",
    marginTop: -2,
  },
  poolBusyCard: {
    backgroundColor: "rgba(45,159,111,0.16)",
    borderWidth: 1,
    borderColor: "rgba(80,200,140,0.45)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  poolBusyTitle: {
    color: "#b8f5d4",
    fontWeight: "800",
    fontSize: 15,
  },
  poolBusyBody: {
    color: "#9ab8a8",
    fontSize: 13,
    lineHeight: 18,
  },
  poolBusyBtn: {
    color: "#7dffa0",
    fontWeight: "800",
    fontSize: 14,
    marginTop: 4,
  },
  secondary: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: "center",
  },
  secondaryInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryText: { color: "#c5d0e0", fontWeight: "600", fontSize: 15 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ff2d55",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  note: { color: "#6b7a90", fontSize: 12, lineHeight: 18, marginTop: 16 },
});
