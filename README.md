## Getting Started


## 使用方法

1. 运行 
2. 将文件[build.config.examples.js](build.config.examples.js) 重命名为 build.config.js
3. 修改 build.config.js 内容,完成打包配置
4. 运行 ```npm install```
5. 运行打包命令 ```npm run build```
6. 支持的命令
```shell
    npm run build
```
```shell
    npm run build:android
```
```shell
    npm run build:ios
```

### 支持的应用类型

本项目支持两种类型的应用：
1. **PWA 应用** - 封装远程 PWA 网站为原生应用
2. **本地应用** - 使用本地 Web 资源的标准 Capacitor 应用

通过修改 [build.config.js](file:///Users/zhuyifang/Code/capacitor-auto-build-app/build.config.js) 中的 `appType` 配置项来选择应用类型：
- `appType: "pwa"` - PWA 应用（默认）
- `appType: "local"` - 本地应用

### PWA 应用配置
对于 PWA 应用，需要配置 `startUrl` 指向要封装的 PWA 网站地址。

### 本地应用配置
1. 将 `appType` 设置为 `"local"`
2. 配置 `localWebDir` 为你的项目编译后的目录路径（默认为 "dist"）
3. 确保在运行构建脚本前，已经执行了前端项目的构建命令（如 `npm run build`）

6. 支持的命令


### 注意
#### 打包IOS应用,必须使用 Mac OS.
