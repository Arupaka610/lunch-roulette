# 🎲 ランチルーレット

今日のランチを迷ったときに、近くのレストランをランダムに決めてくれるWebアプリです。

**デモ:** https://arupaka610.github.io/lunch-roulette/

---

## 機能

- 📍 **GPS で現在地取得** — ブラウザの位置情報を使用
- 🔍 **半径指定で検索** — 300m / 500m / 1km / 2km から選択
- 🍜 **ジャンルフィルター** — 和食・ラーメン・寿司・中華など12種
- 💴 **予算フィルター** — ¥〜¥¥¥¥ の4段階
- 🎲 **ルーレット演出** — 3店舗がアニメーションで順番に出現
- 🗺️ **Google マップ連携** — 選んだお店をそのまマップで開ける

## スクリーンショット

| 検索画面 | ルーレット画面 | 詳細画面 |
|---|---|---|
| 半径・ジャンル・予算を選択 | 3店舗がランダムに出現 | 評価・住所・マップリンク |

## 使い方

1. ブラウザで位置情報の使用を許可
2. 検索範囲・ジャンル・予算を選ぶ（ジャンルと予算は任意）
3. 「🎲 ランチを探す！」をタップ
4. 表示された3枚のカードから1つを選択
5. 詳細情報と Google マップリンクを確認

## ローカルで動かす

```bash
git clone https://github.com/Arupaka610/lunch-roulette.git
cd lunch-roulette
```

`js/config.js` を開いて API キーを入力：

```js
const GOOGLE_MAPS_API_KEY = 'AIzaSy...';
```

ローカルサーバーを起動：

```bash
python -m http.server 8000
# → http://localhost:8000 をブラウザで開く
```

## デプロイ（GitHub Pages）

GitHub Secrets に以下の3つを登録すると、`main` ブランチへの push で自動デプロイされます。

| Secret 名 | 内容 |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Google Maps / Places API キー |
| `ADSENSE_CLIENT` | AdSense パブリッシャー ID（`ca-pub-...`） |
| `ADSENSE_SLOT` | AdSense 広告ユニット ID |

Settings → Pages → Source を **GitHub Actions** に設定してください。

## 使用技術

- HTML / CSS / JavaScript（フレームワークなし）
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript) — Places API (New)
- [Google AdSense](https://adsense.google.com/)
- GitHub Actions — CI/CD
- GitHub Pages — ホスティング

## 必要な API キー

[Google Cloud Console](https://console.cloud.google.com/) で以下の API を有効化してください。

- Maps JavaScript API
- Places API (New)

セキュリティのため、API キーの HTTP リファラー制限を設定することを強く推奨します：

```
https://arupaka610.github.io/*
http://localhost:8000/*
```

## ライセンス

MIT
