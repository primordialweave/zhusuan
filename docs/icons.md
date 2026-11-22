# 平台图标

1.2.0 的平台图标采用 A2 算盘构图：青玉槽、五颗透光翠玉珠与暖琥珀金珠。浅色规范输入为 `build/appicon.png`，macOS 夜雨深色输入为 `build/appicon-dark.png`，两张均为 1024×1024，构图位置保持一致。网页和其他平台从浅色输入派生，macOS 另将深色资源编入系统图标目录。

重新生成全部平台图标：

```sh
python3 -m pip install -r scripts/requirements-icons.txt
python3 scripts/generate_icons.py --input build/appicon.png
```

图像更新到 `build/appicon.png` 后也可运行 `task icons`。macOS 脚本自动读取同目录的 `appicon-dark.png`，也可通过 `--dark-input` 指定深色源。标准打包消费已生成并提交的资源，不要求额外安装Pillow；重新生成全部派生图标需要 Pillow。

| 平台 | 输出 |
| --- | --- |
| macOS | `build/darwin/icons.icns` 兼容旧系统；`build/darwin/Assets.car` 含浅/深系统图标；运行时 Dock 显式使用浅色 `build/appicon.png` |
| Windows | build/windows/icon.ico；16/32/48/64/128/256像素 |
| MSIX | 六个方形、宽磁贴和启动图PNG，原画比例居中 |
| Linux | hicolor128/256/512 PNG；AppImage使用512像素 |
| iOS | 不透明RGB的1024主图与15个唯一PNG、18个catalog条目 |
| Android | 五种density的launcher/round PNG；圆形版只裁外层底 |
| Web | `frontend/public/zhusuan.png`、`favicon.ico`；关于页字标为 `zhusuan-wordmark.png` |

桌面与Web保留透明度；iOS合成到图内浅青瓷背景，避免透明角被当作黑色。iOS `xcode:gen` 之后会覆盖成规范的不透明catalog图标，防止工程生成步骤重新带入透明或旧版本图标。

macOS 包显示为 `珠算.app`，内部可执行文件仍叫 `zhusuan`。`scripts/build_macos_icon.py` 从浅色源生成标准透明 ICNS，并在 Xcode 26 及以后编译 `build/darwin/AppIcon.icon`。图层设置 `scale: 1.18`、画布填充为 `none`，避免已有图标底面再套一层外板。该设置仅调整平台图层构图，不改源图；需用 `NSWorkspace.icon(forFile:)` 的实际渲染检查，不能只看 PNG 或 ICNS 解码图。

深浅双态由 `icon.json` 中的 `image-name-specializations` 指定：默认值为 `Artwork.png`，`appearance: dark` 为 `Artwork-Dark.png`。脚本将两张规范输入缩放到 `build/darwin/AppIcon.icon/Assets/` 后编译。不要同时声明普通 `image-name` 与特化键；`actool` 可能编译成功却静默忽略深色资源。系统是否使用深色图标取决于系统外观及图标设置；Wails 运行时 Dock 显式设置的浅色 PNG 不随此目录切换。

`Assets.car` 与 `Assets.car.source.sha256` 一起提交，让旧 Xcode 构建机仍可打包。摘要涵盖 `build/appicon.png`、`icon.json` 和存在时的 `build/appicon-dark.png`；任一输入改变后，旧 Xcode 会明确报错，要求先用 Xcode 26 或更新版本重新生成，防止静默沿用旧图标。`Info.plist` 同时保留 `CFBundleIconFile=icons.icns` 和 `CFBundleIconName=AppIcon`，为新旧系统选择对应资源。

重新编译与核验双态目录：

```sh
python3 scripts/build_macos_icon.py --input build/appicon.png --dark-input build/appicon-dark.png --output build/darwin/icons.icns
python3 -m unittest discover -s scripts -p 'test_macos_icon.py'
xcrun assetutil --info build/darwin/Assets.car
```

核对 `NSAppearanceNameAqua` 与 `NSAppearanceNameDarkAqua` 都存在、分别引用 `Artwork` 与 `Artwork-Dark`，且两组 `IconGroup` SHA1 不同。再用 Icon Composer 的 `ictool` 导出 `Default` / `Dark` 两种 rendition 到临时目录，复核布局和深浅效果；编译退出码不能替代这一步。发行包的 `Contents/Resources/Assets.car` 应核对对应发行源码的输入与双态内容，不能拿开发 watch 重编后的工作区摘要比较已发布产物；工具时间戳也可能改变目录字节摘要。

关于页使用 `frontend/public/zhusuan-wordmark.png`，不参与平台图标生成。Web 图标统一为 `zhusuan.png`，生成脚本不再输出旧文件名的副本。重新生成平台资源时使用 `build/appicon.png`，深色输入仍为 `build/appicon-dark.png`。
