# Tumbled Bitmap Font 圆石点阵黑

This font is designed for PebbleOS, containing approximately 8100 Chinese characters, as well as support for Japanese and Korean. Most of the variants are modified and adjusted from existing open-source fonts. However, the Chinese characters in TUMBLED_18 were designed from scratch due to the lack of alternative open-source fonts in similar sizes.

If you are looking for more condensed font similar to PebbleOS's Gothic, check out [Kyanite Bitmap Font](https://github.com/TsFreddie/KYANITE).

本字体是为 PebbleOS 设计的点阵字体，包含约8100个简繁汉字，以及日语与韩语的支持。大部分大小的字体是使用现有的开放字体修改与加工调整而来。其中 TUMBLED_18 的汉字部分则因为没有现有的开放字体，所以是从头开始手工设计的。

如果你更喜欢与PebbleOS的Gothic类似的压缩宽度的字体，推荐 [Kyanite Bitmap Font](https://github.com/TsFreddie/KYANITE).

## Download 下载

**[Download the latest release 下载最新版本](https://github.com/TsFreddie/TUMBLED/releases/latest)**

### Packs 字体包

Each release ships the full pack plus reduced ones. Every pack fills the whole
resource layout the firmware expects; the reduced packs alias font variants that
the watch's notifications never use to an existing design of the same size, and
the pack format stores identical contents only once.

每次发布都会提供完整包和精简包。所有字体包都会填满固件所需的全部资源槽位；精简包会把通知中不会用到的字重指向同尺寸的现有设计，而字体包格式对相同的内容只存储一份。

| Pack                   | Watch         | Slots | Aliases                                        |
| ---------------------- | ------------- | ----- | ---------------------------------------------- |
| `TUMBLED_P2D.pbl`      | Pebble 2 Duo  | 19    | none (TUMBLED_14/18/24/28, regular and bold)   |
| `TUMBLED_LITE_P2D.pbl` | Pebble 2 Duo  | 19    | `14_BOLD`→`14`, `24`→`24_BOLD`, `28_BOLD`→`28` |
| `TUMBLED_PT2.pbl`      | Pebble Time 2 | 21    | none (adds TUMBLED_36, regular and bold)       |
| `TUMBLED_LITE_PT2.pbl` | Pebble Time 2 | 21    | `14_BOLD`→`14`, `36_BOLD`→`36`                 |
| `TUMBLED_MINI_PT2.pbl` | Pebble Time 2 | 21    | LITE plus `18_BOLD`→`18`, only `Medium` uses   |

The aliases are chosen around notifications at the watch's default content size
(Pebble 2 Duo: `Medium`, Pebble Time 2: `Large`). Aliased slots still render
TUMBLED glyphs, but show the referenced design: with `TUMBLED_MINI_PT2`,
switching the watch to `Medium` or `ExtraLarge` makes notification headers and
titles use the regular weight.

精简包的别名是按手表默认字号下的通知来选择的（Pebble 2 Duo 为 `Medium`，Pebble Time 2 为 `Large`）。被指向的槽位依然会渲染 TUMBLED 字形，只是显示所指设计：使用 `TUMBLED_MINI_PT2` 时，如果把手表字号切换到 `Medium` 或 `ExtraLarge`，通知标题会改用常规字重。

## Variants

TUMBLED_14

- Directly generated from [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) for its readability, added missing glyphs to reach our target.

TUMBLED_18

- Designed from scratch, and used [Galmuri](https://github.com/quiple/galmuri) for hiraganas, katakanas and hanguls.

TUMBLED_24

- Used [Unifont](https://unifoundry.com/unifont/index.html) as a reference and adjusted strokes to be more aesthetically similar to Pebble's Gothic, with redesigned hiraganas, katakanas and bopomofos.

TUMBLED_28

- Directly generated from [Source Han Sans](https://github.com/adobe-fonts/source-han-sans). Due to the larger size, the generated ones are generally readable without any modification.

TUMBLED_36

- Directly generated from [Source Han Sans](https://github.com/adobe-fonts/source-han-sans), for the Pebble Time 2 `GOTHIC_36_EXTENDED` slots.

## Preview

| Font Variant | Regular                                        | Bold                                                     |
| ------------ | ---------------------------------------------- | -------------------------------------------------------- |
| TUMBLED_14   | ![TUMBLED_14 Preview](./images/TUMBLED_14.png) | ![TUMBLED_14_BOLD Preview](./images/TUMBLED_14_BOLD.png) |
| TUMBLED_18   | ![TUMBLED_18 Preview](./images/TUMBLED_18.png) | ![TUMBLED_18_BOLD Preview](./images/TUMBLED_18_BOLD.png) |
| TUMBLED_24   | ![TUMBLED_24 Preview](./images/TUMBLED_24.png) | ![TUMBLED_24_BOLD Preview](./images/TUMBLED_24_BOLD.png) |
| TUMBLED_28   | ![TUMBLED_28 Preview](./images/TUMBLED_28.png) | ![TUMBLED_28_BOLD Preview](./images/TUMBLED_28_BOLD.png) |
| TUMBLED_36   | ![TUMBLED_36 Preview](./images/TUMBLED_36.png) | ![TUMBLED_36_BOLD Preview](./images/TUMBLED_36_BOLD.png) |

Comparison between the current official language pack `en_CN` and `TUMBLED_24_BOLD` in `Default` text size:

| Pebble (en_CN)                               | TUMBLED_24_BOLD                                  |
| -------------------------------------------- | ------------------------------------------------ |
| ![Compare_en_CN](./images/Compare_en_CN.png) | ![Compare_TUMBLED](./images/Compare_TUMBLED.png) |

## Progress & Roadmap

- [ ] Provide hant and jp version with regional glyph shapes

## Build

To build the fonts, [PebbleFontTool](https://github.com/TsFreddie/PebbleFontTool) is available as a separate repository.

```bash
# Clone the scripts
git clone https://github.com/TsFreddie/PebbleFontTool.git

# Setup the build environment
cd PebbleFontTool
bun install
cd..

# Run the build script
bun run ./build.js
```

`build.js` only builds the PBF files and packs them into `.pbl` files from the
glyph sources in `fonts/`. To regenerate the codepoint set and the glyph
sources themselves, run the scripts from the PebbleFontTool checkout:

```bash
# Rebuild build/pages.txt from PebbleFontTool/data/pages
bun run ./PebbleFontTool/scripts/combine.ts

# Rebuild the reference font used by the editor (fonts/unifont)
bun run ./PebbleFontTool/scripts/extract.ts

# Rebuild one variant, e.g. TUMBLED_14 (definition in build/)
bun run ./PebbleFontTool/scripts/extract.ts build/fusion12.json

# TUMBLED_36, the Pebble Time 2 size (definition in build/)
bun run ./PebbleFontTool/scripts/extract.ts build/TUMBLED_36.json
```

## Licenses

This repository and packaged fonts are licensed under OFL 1.1.

## Acknowledgements

[Unifont](https://unifoundry.com/unifont/index.html) ([OFL 1.1](https://unifoundry.com/OFL-1.1.txt) Licensed) is used both as a design reference for TUMBLED_24 and TUMBLED_18, and as a glyph availability reference for other fonts.

[Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) ([OFL 1.1](https://github.com/TakWolf/ark-pixel-font/blob/master/LICENSE-OFL) Licensed) is used directly
for generating TUMBLED_14.

[Source Han Sans](https://github.com/adobe-fonts/source-han-sans) ([OFL 1.1](https://github.com/adobe-fonts/source-han-sans/blob/master/LICENSE.txt) licensed) is used directly for generating TUMBLED_28 and TUMBLED_36.

[Galmuri](https://github.com/quiple/galmuri) ([OFL 1.1](https://github.com/quiple/galmuri/blob/main/ofl.md) licensed) is used as the design for hangul glyphs for several fonts.
