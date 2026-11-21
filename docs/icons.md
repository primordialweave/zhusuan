# 平台图标

当前图标使用用户提供的 `frontend/public/帝王绿翡翠算盘图标.png`，原文件保留不变。构建的唯一规范输入是 `build/appicon.png`；网页使用256像素输出，Windows格式由Wails生成，macOS由平台脚本生成。

重新生成全部平台图标：

```sh
python3 -m pip install -r scripts/requirements-icons.txt
python3 scripts/generate_icons.py --input frontend/public/帝王绿翡翠算盘图标.png
```

图像更新到 `build/appicon.png` 后也可运行 `task icons`。标准打包消费已生成并提交的资源，不要求额外安装Pillow。

| 平台 | 输出 |
| --- | --- |
| macOS | build/darwin/icons.icns 兼容旧系统；Assets.car 用于新版系统；运行时 Dock 直接使用新原画 PNG（build/appicon.png） |
| Windows | build/windows/icon.ico；16/32/48/64/128/256像素 |
| MSIX | 六个方形、宽磁贴和启动图PNG，原画比例居中 |
| Linux | hicolor128/256/512 PNG；AppImage使用512像素 |
| iOS | 不透明RGB的1024主图与15个唯一PNG、18个catalog条目 |
| Android | 五种density的launcher/round PNG；圆形版只裁外层底 |
| Web | zhusuan.png及兼容旧图标URL、favicon.ico |

桌面与Web保留透明度；iOS合成到图内浅青瓷背景，避免透明角被当作黑色。iOS `xcode:gen` 之后会覆盖成规范的不透明catalog图标，防止工程生成步骤重新带入透明或旧版本图标。

macOS 包显示为 `珠算.app`，内部可执行文件仍叫 `zhusuan`。`scripts/build_macos_icon.py` 生成标准透明 ICNS，并在 Xcode 26 及以后编译 `build/darwin/AppIcon.icon`。当前帝王绿原画主体透明边界与旧图接近，沿用并重新验证现有构图。原画已有圆角与透明留白，而 Icon Composer 会再套系统图标轮廓；图层设置 `scale: 1.18`、画布填充为 `none`，让青瓷底覆盖系统轮廓，避免内外两层底板。该设置仅调整平台图层构图，不改原画；需用 `NSWorkspace.icon(forFile:)` 的实际渲染检查，不能只看 PNG 或 ICNS 解码图。

`Assets.car` 与来源校验文件一起提交，让 Xcode 16 的构建机仍可打包。校验涵盖原始 PNG 和 `icon.json`；任一输入改变后，旧 Xcode 会明确报错，要求先用 Xcode 26 或更新版本重新生成，防止静默沿用旧图标。`Info.plist` 同时保留 `CFBundleIconFile=icons.icns` 和 `CFBundleIconName=AppIcon`，为新旧系统选择对应资源。

2026-11-20 品牌资源更新：应用图标采用用户新增“帝王绿翡翠算盘图标.png”，关于页另用“玉雕风珠算字标.png”。两张原始文件保留不变。应用原图1254×1254 RGBA，透明边缘包含少量原图自带的零星色点，生成只做等比缩放/必要平台合成，不擅自清理或重画。关于字标不参与平台图标生成。
