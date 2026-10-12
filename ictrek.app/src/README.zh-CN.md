# V-Sub __APP_VERSION__

字幕转写、翻译、校对、配音、烧录与音视频导出。保留 SmartSub 的工作流和原有模型管理，改为 VOS 浏览器入口。

从 VOS 打开应用后自动通过 OIDC Fastpath 登录，自动读取 V-Router 的 ASR/TTS 模型，包括 V-Voice 和已配置的标准云端接口。云服务凭据统一在 V-Router 管理；此应用不要求重复填写。V-Voice 的音色按所选模型读取。标准云 TTS 不提供音色列表时使用标准 OpenAI 音色，可在原服务配置中调整。

文件通过上传按钮或拖入浏览器导入；媒体、任务、模型、设置与生成文件按已验证 VOS 用户隔离。导出目录位于用户自己的应用存储中，打开导出文件时通过浏览器下载。不要在浏览器输入宿主机任意路径。

原有本地引擎和模型可以在「引擎与模型」中安装。只有安装完成且运行时可用的 ASR/TTS 模型自动注册到 V-Router，注册范围为当前账户私有，30 秒更新、90 秒租约；V-Router 重启后自动恢复。ZipVoice 在模型和用户参考音色就绪后同样私有注册；参考音频与音色不会跨账户共享。

CPU profile 使用 CPU 本地引擎；AMD CUDA、ARM CUDA、Jetson/L4T 和 Thor profile 使用 V-Voice 对应平台的专用 sherpa-onnx GPU wheel 及匹配的 CUDA / ONNX Runtime 库。L4T Paraformer 沿用 V-Voice 的 CPU 兼容回退。ARM 的 whisper.cpp 插件从上游源码构建。其他引擎是否可用以对应运行时及模型安装状态为准，不将不支持的运行时标成可用。

语言菜单提供「跟随 VOS / 简体中文 / 繁體中文 / English」。切换不刷新页面。独立打开回退浏览器语言；手动选择只写入 V-Sub 自己的浏览器存储。
