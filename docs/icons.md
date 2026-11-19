# 平台图标

当前图标使用用户提供的 `frontend/public/Zhusuan-Dock-Celadon.png`，原文件保留不变。构建的唯一规范输入是 `build/appicon.png`；网页使用256像素输出，桌面格式由Wails生成。

重新生成全部平台图标：

```sh
python3 -m pip install -r scripts/requirements-icons.txt
python3 scripts/generate_icons.py --input frontend/public/Zhusuan-Dock-Celadon.png
```

图像更新到 `build/appicon.png` 后也可运行 `task icons`。标准打包消费已生成并提交的资源，不要求额外安装Pillow。

| 平台 | 输出 |
| --- | --- |
| macOS | build/darwin/icons.icns；bundle与运行时Dock共用 |
| Windows | build/windows/icon.ico；16/32/48/64/128/256像素 |
| MSIX | 六个方形、宽磁贴和启动图PNG，原画比例居中 |
| Linux | hicolor128/256/512 PNG；AppImage使用512像素 |
| iOS | 不透明RGB的1024主图与15个唯一PNG、18个catalog条目 |
| Android | 五种density的launcher/round PNG；圆形版只裁外层底 |
| Web | zhusuan.png及兼容旧图标URL、favicon.ico |

桌面与Web保留透明度；iOS合成到图内浅青瓷背景，避免透明角被当作黑色。iOS `xcode:gen` 之后会覆盖成规范的不透明catalog图标，防止工程生成步骤重新带入透明或旧版本图标。
