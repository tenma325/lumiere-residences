# LUMIÈRE — THE RESIDENCE 麻布

高級分譲マンションの「分譲中」ランディングサイト。サイト中央に建つ3Dタワーの
**空室をクリック**すると、その住戸へ吸い込まれるカメラ演出（フライイン）が走り、
**平面図と寸分違わぬ室内**を3Dで歩くように見回せます。

デザインの基軸は `cinematic-stream-hero`（漆黒キャンバス＋リキッドグラス＋
blur-fade-up 演出）。そこへ Shippori Mincho の和文見出しとシャンパンゴールドの
差し色を重ね、ラグジュアリーな世界観に仕立てています。

## 体験フロー

1. **ヒーロー** — 画面ど真ん中に高級タワーレジデンスの3Dイメージ（点灯する窓・
   バルコニー・クラウン）。`分譲中 / NOW SELLING` バッジ。
2. **スクロール → 分譲住戸一覧** — 「部屋番号 ＋ 平面図」を1セットにしたカードを複数掲載。
   空室／商談中／成約をバッジ表示。
3. **空室をクリック** — タワー中央のその住戸へカメラがフライイン → フェードブリッジ →
   全画面の3Dインテリアへ。
4. **3Dインテリア** — 暮らしをイメージした家具を配置したパノラマ室内。ドラッグで見回し、
   スクロールでズーム。右下のミニ平面図に現在地（リビング）を表示。

## 整合性の肝：単一データモデル

平面図と3D室内が必ず一致するよう、各間取りは **`src/types.ts` のスキーマで一度だけ
メートル単位で定義** しています（`src/data/residences.ts`）。

- `src/lib/layout.ts` の `buildWalls()` が、部屋の矩形から壁・建具・窓・バルコニー手すりを
  **導出**します。
- `FloorPlan.tsx`（2D SVG）と `InteriorScene.tsx`（3D）は **同じ `buildWalls()` の結果** を
  描画するため、2Dと3Dがずれません。

間取りを足す／変えるときは `residences.ts` の数値だけ触れば、平面図も3Dも自動で追従します。

## 技術スタック

- React 18 + TypeScript + Vite 6
- Tailwind CSS v4（`@tailwindcss/vite`）
- three.js 0.169 / @react-three/fiber 8 / @react-three/drei 9
- GSAP（カメラのフライイン）
- lucide-react（アイコン）

タワー外観・夜景・大半の室内は**手続き的にコード生成**（ブラウザ単体で確実に描画でき、
データモデルと常に整合）。さらに **空室の数戸（32-01 / 31-02 / 30-03）は Blender で
高精細化** し、生活感のある室内を 360° パノラマとして書き出しています（下記）。

## Blender 高精細パノラマ（実写3D・昼/夜・複数視点）

内装は **プラン単位（A/B/C）** で Blender(Cycles) のフォトリアル 360° パノラマを用意し、
同プランの全空室で共有します（→ 全空室が実写内覧に対応、カードに「実写3D」バッジ）。
各プランにつき **リビング・ベッドルームの2視点 × 昼・夜の2バリエーション = 4枚**。

- 内覧中は右下の**間取りを拡大**でき、**破線の部屋をクリックするとその視点へジャンプ**
  （`src/components/InteriorViewer.tsx` ＋ `FloorPlan` の clickableRooms）。
- 右上の **昼/夜トグル**で、室内パノラマ（昼/夜レンダー）とヒーローのタワー（後述）が連動。
- **マテリアル**：手続き的な木目（Wave）・大理石の脈（Noise）・布の織り＋微小バンプ・
  壁の凹凸・クリアコート反射（床/大理石/OLED）で「のっぺり感」を排除。
- **家具**：面取り＋サブサーフでクッションを膨らませ、観葉は Displace で有機的な樹形に。
- **照明**：夜は「弱い面光源＋家具上の強いプール＋コーブ間接光」で陰影/ムード、昼は
  採光ポータルを抑えて窓のディテールを保持。カメラは1.2mで家具を主役に。
- **グロー**：`PanoramaViewer.tsx` で実行時 Bloom（明るい窓/照明が発光）。
- 表示は手動でテクスチャを読込/破棄し常駐1枚に抑制（4Kはコンテキスト喪失したため3072×1536）。

```bash
# 1) 間取り＋壁データを JSON 出力（site のデータと完全一致）
npx tsx scripts/export-plans.ts            # -> blender/plans.json

# 2) 全プラン×2視点×昼夜=12枚を Cycles でレンダリング（AMD は HIP 自動）
#    引数: plansCSV roomsCSV timesCSV resX samples（空文字=全部）
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b --python blender/render_interiors.py -- "" "" "" 3072 256
#    -> public/panoramas/<plan>_<room>_<time>.jpg (例 A_ldk_night.jpg)
#    -> src/data/viewpoints.json（視点座標＋画像パス。サイトが読み込む）
```

- 視点を増やすには `render_interiors.py` の `plan_viewpoints()` に部屋を追加。
- サイトは `src/data/viewpoints.json`（プラン→視点配列）を `residences.ts` 経由で参照。

## Blender 高精細タワー外観（サイトの顔 / GLB）

ヒーロー中央のタワーは **Blender(bmesh) で最大密度に作り込んだ実モデル**を
`public/models/tower.glb` として書き出し、`TowerScene.tsx` が `useGLTF` で読み込みます。

- **カーテンウォール**：階ごと・ベイごとのビジョンガラス＋スパンドレル＋方立(マリオン)＋
  スラブ見付。窓は**ランダムに点灯**（暖色／寒色）。
- **バルコニー**（前面＋側面）／**ゴールドのコーナーフィン**／**段状の発光クラウン＋
  スパイア＋航空障害灯**／**ダブルハイトのロビー・エントランスキャノピー**／
  **植栽・リフレクティングプール・ボラード照明のあるプラザ**。
- three 側で **Bloom（@react-three/postprocessing）** を掛け、窓・クラウンが
  シネマティックに発光。住戸マーカーとフライインは従来どおり機能（寸法は
  `TowerScene.tsx` の `TOWER` 定数と一致）。
- **昼/夜トグル**に連動：夜＝暗空＋点灯窓＋強Bloom、昼＝drei `<Sky>` の青空＋
  日中ライティング＋ガラスを明るい反射面に切替（GLBマテリアルを実行時に調整）。

```bash
# タワー外観を再生成（プレビュー静止画 + GLB 書き出し。AMD は HIP 自動使用）
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b --python blender/build_tower.py
#  -> public/models/tower.glb (約1.5MB, ジオメトリのみ) + blender/_tower_preview.jpg
```

GLB は ~1.5MB（テクスチャ無し・マテリアル別にメッシュ統合＝低ドローコール）。Blender は
Z-up・前面+Y で生成し、glTF 変換後 three 側で 180° 回転して前面を +Z に合わせています。

## 開発

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 型チェック + 本番ビルド
npm run preview
```

### ビジュアル検証

`verify.mjs` は puppeteer-core で Chrome を起動し、ヒーロー／一覧／室内の
スクリーンショットを `shots/` に保存、コンソールエラーを集計します。

```bash
npm run dev      # 別ターミナルで起動しておく
node verify.mjs
```

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `src/types.ts` | 共有データモデル（間取り・家具・住戸） |
| `src/data/residences.ts` | 3つの間取り（3LDK/2LDK/1LDK）と8住戸 |
| `src/lib/layout.ts` | 部屋矩形 → 壁/建具/窓の導出、表示ヘルパー |
| `src/components/TowerScene.tsx` | ヒーローの3Dタワー＋住戸マーカー＋フライイン |
| `src/components/InteriorViewer.tsx` | 全画面3D内覧オーバーレイ＋UI |
| `src/components/InteriorScene.tsx` | データから室内（壁/床/天井/家具）を生成 |
| `src/components/FloorPlan.tsx` | データから2D平面図SVGを生成 |
| `src/components/furniture/Furniture.tsx` | 3D家具キット |
| `src/App.tsx` | フライイン→フェード→内覧のステートマシン |

> 画面・価格・所在はすべてイメージのサンプルです。
