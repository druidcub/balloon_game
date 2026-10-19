# 音效來源與授權

所有素材均隨遊戲打包於本機，播放時不會連線。`audio-assets.js` 包含相同 MP3 的 Base64，以支援直接開啟 `index.html` 時的 Web Audio 解碼；`assets/audio/` 保留可替換的 MP3。

| 檔案 | 原始作品／作者 | 授權 | 本遊戲修改 |
|---|---|---|---|
| balloon.mp3 | [Letting air out of Balloon, sound effect — Curious Eyes](https://www.youtube.com/shorts/5ZbmQRrjiJ4) | 影片未標示 CC 授權，保留原作者權利；依使用者指定作本機剪輯 | 擷取 2.12–3.06 秒，65 Hz 高通／3500 Hz 低通、音量處理與短淡入淡出。遊戲以 120 ms 原錄音片段重疊交叉淡化為 2 秒循環，保留橡膠抖動質感，氣量平滑控制播放速率，不使用單週期哨音重建 |
| laughter.mp3 | [Big Burst Crowd Laughter 70 — SFXMint](https://sfxmint.com/sets/video-editing) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 擷取前 3.8 秒、音量正規化、淡入淡出 |
| applause.mp3 | [Polite Light Crowd Applause 72 — SFXMint](https://sfxmint.com/sets/video-editing) | CC0 1.0 | 擷取前 3.5 秒、音量正規化、淡入淡出；依分級改變長度與音量 |
| wow.mp3 | [Crowd Wow Surprise People — dersuperanton, Freesound](https://freesound.org/people/dersuperanton/sounds/437645/) | CC BY 4.0 | 使用公開 HQ 預覽版，轉碼與音量正規化；疊加掌聲 |
| encore.mp3 | [encore cheering.wav — tim.kahn, Freesound](https://freesound.org/people/tim.kahn/sounds/191527/) | CC BY 4.0 | 使用公開 HQ 預覽版，擷取 8–13 秒、轉碼、音量正規化與淡入淡出；疊加掌聲 |
| inhale.mp3 | [急促的呼吸聲（Rapid breathing）— Music Sound Effects](https://www.youtube.com/watch?v=l3MzhdcSZNQ) | 影片未標示 CC 授權，保留原作者權利；依使用者指定作本機剪輯 | 擷取 3.74–4.30 秒的吸氣段，避開前一段呼氣，保留原速，100 Hz 高通／3800 Hz 低通、音量處理與淡入淡出；一次補氣只播放一次 |

SFXMint 的掌聲與笑聲素材由來源網站標示為 AI 生成。Freesound 的驚嘆與安可使用原作者的觀眾錄音。畫面底部的「音效來源與授權」也包含署名與授權連結。

吹氣與氣球爆裂的短促爆音由 Web Audio 即時合成。漏氣與吸氣使用上述指定影片錄音；僅在素材解碼失敗時使用合成備援。

修改 MP3 後，可在本資料夾執行 `node pack-audio.cjs` 重新建立離線音效包。

往左落地的失落音效由 Web Audio 即時合成：三個柔和三角波低音依序下降，經低通濾波與音量包絡，不使用第三方素材；可在「音效試聽 → 失落」預聽。
