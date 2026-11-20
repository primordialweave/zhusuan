# 依赖更新检查（2026-11-20）

用户授权在发布1.0.2后处理依赖PR并更新全部依赖。1.0.2发行源码固定于独立标签，以下依赖升级另行合入主分支，不回写公开安装包。

## 更新范围

前端直接依赖全部更新至当前最新兼容稳定版：React/DOM19.3.1成对、types19.3，Wailsruntime3.1，Vite8.3.8/plugin6.3，Vitest5.1.1/jsdom31/jestdom8，ESLint10.15/typescripteslint8.73，Tailwind4.3.5等。TypeScript6.0.3保留在typescripteslint明确peer<6.1范围，Node类型24.19.2匹配项目Node24；不会仅为关闭PR采用不匹配的Node26类型。前端engine为^24.15.0。

后端24个直接依赖与应用/测试可达间接依赖更新为最新稳定，WailsGo与runtime同步3.1；Gin1.12、mysql1.10.2、pgx5.13、Prometheus1.25、Redis9.23、testify1.12.1、Zap1.28、crypto0.59、GORM1.31.2等。go语言最低1.26.10（新依赖要求），toolchain使用仍支持macOS12的最新维护版1.26.11；Go1.27要求macOS13，因此不为工具链大版本增加用户系统要求。原plist/CGO10.15低于Go1.26实际最低12，已校正为12；两架构Mach-O minos12复验。

Actions四份workflow40引用更新精确稳定patch（checkout7.0.1、download8.0.2、upload7.0.2、setupnode/go/python7.1.0、CodeQL4.39.3、Dockerlogin4.8/buildx4.4.1/metadata6.2/buildpush7.4、ghrelease3.0.4、lintaction9.3、codecov7.1.1）。上游15份actionmanifest验证全部41steps输入兼容，Node24runner要求由GitHubhosted满足。WailsCLI3.1/task3.54/lint2.15更新，gosec2.30和Trivyaction0.36已最新，Trivy扫描器显式更新为0.76.2。API容器运行基础镜像更新Alpine3.24.4；旧非发布使用的Zig/macOSSDK跨编译预设保留独立验证边界。DependabotReact/runtime/types分组，移除无效旧指派及Vue规则。

## 必要迁移与验证

Vite8的esbuilddrop迁移到Rolldown/Oxc生产压缩，保留dropconsole/debugger；TS6显式node/vitest类型；ESLint10删除Calendar无用初始赋值；jsdom31测试检查实际已解析token及zindex严格值，未削弱主题/令牌/弹层断言。

本地前端116文件608用例、ESLint0、TS与productionbuild、npmls无peer冲突、全依赖和productionaudit0。窗口命令队列新增4回归后，最终116文件612例/ESLint0/TS6productionbuild再次通过。Go1.26.11race141顶层159子测试/16包、vet、Windowsamd64及两Macproductioncompile通过；模块verify、Wails3.1 bindings临时输出582packages/3services8methods通过。新版lint2.15增量0，旧全量历史告警仍保留。24direct与77app/test可达模块go-list更新检查无更新；不可达的上游CLI自有工具图不硬钉成业务直接依赖。

主JS升级后867.79KB/gzip272.10KB，较此前833.92/268.04增加33.87/4.06KB；保留既有500KB提示。无新增空闲轮询，目标设备性能不由包体预算代替验收。Windows普通用户/原生窗口与Mac实际打包将用升级SDK再次CI验收，未完成前不以交叉编译声称原生通过。

当前待最终CI、原生检查与PR合并；旧DependabotPR仅在确认已被本更新覆盖后关闭，分支以精确head和已合并证据清理。

Linux迁移：Wails3.1默认GTK4/WebKitGTK6，CI安装libgtk-4-dev/libwebkitgtk-6.0-dev，deb/rpm/Arch运行依赖同步对应GTK4栈。旧依赖CI准确发现缺pkg-config，修复后以新runner结果为准；Linux支持范围随新Wails依赖要求为Ubuntu24.04+/Debian13+或提供同等库的发行版。
