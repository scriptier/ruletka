---
title: iPhone Safari + PC + Android 3-way — Android isolated
date: 2026-08-14
slug: iphone-pc-android-3way
source_type: note
source_url:
source_path: artifacts/shots/20260814T214909Z-ios3-pc.png
captured_by: agent
skill: add-new-resource
---

# Raw: iPhone + PC + Android 3-way

## Source
- Human 2026-08-14 ~15:48–15:50 MDT
- Shots after hangup: `artifacts/shots/20260814T214909Z-ios3-phone.png` (idle Start) · `…-ios3-pc.png` (Grok TUI; ruletka window not on this display)
- av-verify `20260814T214914Z`

## Original (untouched)

Human: take a screenshot my fiance on her iphone browser connected to my pc browser and we went 3 way with android she say she can see herself and me but not 3rd same thing for pc browser and on android i cant see my 2 conversationalists

Human: when she ended the call it went back to two tiles and on my pc browser i can see the android camera video again

## Scorecard `214914Z`

- verdict WARN · product **one-way**
- last match force_relay=true platforms web↔android
- offers=8 answers=6
- TURN HOT max_rb=1012140 err_437=16
- web fin/fout 4904/4912 ice connected **host→host** (two web clients)
- android fin/fout **0/0** ice=**failed** policy=relay app_vc=400 bind_v=1
- two web ids: 6878837b and 1b14a5bc

## Description

- Mix: iPhone Safari + this PC 1v1 first, Android app joined as 3rd
- During 3-way: browsers see each other; neither sees Android; Android sees nobody
- After iPhone hangup: 2 tiles; PC sees Android again
- Agent shots missed live 3-way (call already ended)

Do not invent MULTI_PASS / product.ok.
