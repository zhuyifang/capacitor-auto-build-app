// build.config.js
// 这是一个用于自动化打包流程的一体化配置文件。
// 它包含了应用的所有基本信息、平台特定设置、证书配置，以及所需的通用权限列表及其对应的用户提示语。
const ANDROID_SDK = "/Users/user1/Library/Android/sdk";
const buildConfig = {
    // --- 通用应用信息 ---
    app: {
        appId: "com.company.app", // 应用的唯一标识符 (例如: "com.yourcompany.appname")
        // 应用的显示名称 (用户在设备上看到的名称，例如 "我的应用")
        displayName: "APP Name",
        // 应用的短名称 (用于桌面图标等，通常是 displayName 的缩写，例如 "MyPWA")
        shortName: "MyPWA",
        // 应用版本名称 (用户可见的版本号，例如 "2.0.4")
        versionName: "2.0.4",
        // 内部版本号 (用于 Android 的 versionCode 和 iOS 的 buildNumber。
        // 建议标准化为纯数字，例如 "2.0.4" -> 200004。每次构建请手动递增)
        buildNumber: 200004,
        // PWA 的启动 URL (应用将封装和加载的外部 PWA 地址)
        startUrl: "https://vooh.pages.dev/", // **请务必替换为你的 PWA 实际部署 URL**
        // 应用的主题颜色 (用于 Android 任务管理器颜色，以及 PWA 浏览器 UI 元素)
        themeColor: "#4DBA87",
        // 应用的背景颜色 (用于 PWA 启动画面，以及 Android 启动页背景)
        backgroundColor: "#FFFFFF",
        // 默认屏幕方向 (portrait 或 landscape)。
        // 这将影响应用启动时的默认方向，以及 Android Manifest 中的配置。
        defaultScreenOrientation: "portrait", // "portrait" (竖屏) 或 "landscape" (横屏)
        scheme:"http"
    },

    // --- Android 特定配置 ---
    android: {
        buildType: "release",
        // Android 签名 Keystore 路径 (相对于项目根目录)
        keystorePath: "./my_release.keystore", // **请替换为你的实际路径**
        // Keystore 密码 (强烈建议通过环境变量传递，例如 process.env.ANDROID_KEYSTORE_PASSWORD)
        keystorePassword: "xxx", // 请勿直接提交敏感信息到版本控制
        // 密钥别名
        keyAlias: "xxx", // **请替换为你的密钥别名**
        // 密钥密码 (强烈建议通过环境变量传递，例如 process.env.ANDROID_KEY_PASSWORD)
        keyPassword: "xxx", // 请勿直接提交敏感信息到版本控制
    },

    // --- iOS 特定配置 ---
    ios: {
        // iOS 支持的设备方向 (对应 Info.plist 中的 UISupportedInterfaceOrientations) 可选值: "UIInterfaceOrientationPortrait", "UIInterfaceOrientationLandscapeLeft","UIInterfaceOrientationLandscapeRight", "UIInterfaceOrientationPortraitUpsideDown"
        supportedOrientations: ["UIInterfaceOrientationPortrait"],
        p12Type:'distribution', // 证书类型，可选值: distribution / development  / ad-hoc
        p12Path: "xxx.p12", //P12 证书路径
        p12Password: "xxx", // P12 证书密码
        provisioningProfile: "xxx.mobileprovision", // **请替换为你的描述文件名称**
    },

    // --- 通用权限列表 ---
    // 如果一个权限键在此对象中存在，则表示应用需要该权限。
    // 对应的值是向用户显示的权限请求理由。
    // 要禁用某个权限，只需从该对象中删除其键值对即可。
    plugins: [],

    // --- 打包输出路径配置 ---
    output: {
        // APK/IPA 文件将输出到的目录 (相对于项目根目录)
        // 脚本在打包完成后，会将最终的构建产物复制到这个目录
        artifactsDir: "./build",
        // Android APK 文件的具体命名格式（例如：app-release.apk 或 app-2.0.4-release.apk）
        // 支持占位符: {versionName}, {buildNumber}, {date} (YYYYMMDD), {time} (HHmmss)
        androidApkNameFormat: "app-{versionName}-{date}.apk",
        // iOS IPA 文件的具体命名格式（例如：YourAppName.ipa 或 YourAppName-2.0.4.ipa）
        // 支持占位符: {appName}, {versionName}, {buildNumber}, {date} (YYYYMMDD), {time} (HHmmss)
        iosIpaNameFormat: "{appName}-{versionName}-{date}.ipa",
    },
};

export { buildConfig,ANDROID_SDK };