import fs from 'node:fs/promises'; // 使用 fs.promises 进行异步文件操作
import path from 'node:path';
import { execa } from 'execa'; // 确保已安装 execa: npm install execa
import { buildConfig } from '../../build.config.js'; // 导入你的构建配置
import config from '../config.js'; // 导入你的通用配置

/**
 * 执行 Capacitor 项目的基础预处理。
 * 包括更新 capacitor.config.json, 添加原生平台, 和执行 npx cap sync。
 */
async function basePreProcess() {
    console.log('✨ 开始基础项目预处理...');

    const appInfo = buildConfig.app;
    const androidConfig = buildConfig.android;
    const iosConfig = buildConfig.ios; // 假设 buildConfig 中有 iOS 配置

    // --- 1. 更新 Capacitor 配置文件 (capacitor.config.json) ---
    const capConfigPath = path.join(config.PROJECT_ROOT, 'capacitor.config.json');
    try {
        let capConfig = {};
        if (await fs.access(capConfigPath).then(() => true).catch(() => false)) {
            // 如果文件存在，先读取现有内容
            capConfig = JSON.parse(await fs.readFile(capConfigPath, 'utf8'));
        }

        // 通用配置
        capConfig.appId = appInfo.appId; // 通常 appId 和 appName 是跨平台的
        capConfig.appName = appInfo.displayName;
        capConfig.webDir = 'www'; // 确保指向你的构建输出目录

        // 解析 startUrl 以设置 server 配置
        const url = new URL(appInfo.startUrl);
        capConfig.server = {
            url: appInfo.startUrl,
            hostname: url.hostname,
            androidScheme: url.protocol.replace(':', ''), // 移除协议末尾的冒号
            iosScheme: url.protocol.replace(':', ''),
            allowNavigation: [url.hostname], // 允许导航到你的主域名
            allowMixedContent: true, // 允许混合内容 (HTTP/HTTPS)
            cleartext: true, // 允许 HTTP 明文流量
            errorPath: "error.html"
        };
        capConfig.backgroundColor = appInfo.backgroundColor || "#575b5f30"; // 默认背景色
        capConfig.loggingBehavior = buildConfig.buildType === 'release' ? 'production' : "debug";

        // 添加 Android 专属的 buildOptions 到 capacitor.config.json (用于 Cap CLI 内部调用 Gradle)
        // 根据你的要求，只要签名信息存在，就写入，不依赖 buildConfig.platforms.android.enabled
        if (androidConfig.keystorePath && androidConfig.keystorePassword && androidConfig.keyAlias && androidConfig.keyPassword) {
            if (!capConfig.android) capConfig.android = {};
            if (!capConfig.android.buildOptions) capConfig.android.buildOptions = {};

            capConfig.android.buildOptions = {
                keystorePath: path.join(config.PROJECT_ROOT, androidConfig.keystorePath), // 确保是绝对路径或相对项目根路径
                keystorePassword: androidConfig.keystorePassword,
                keystoreAlias: androidConfig.keyAlias,
                keystoreAliasPassword: androidConfig.keyPassword,
                releaseType: androidConfig.releaseType || 'APK', // 从 build.config.js 获取，默认为 APK
                signingType: 'apksigner' // Android 推荐使用 apksigner
            };
            console.log('✅ Capacitor Android 签名配置已写入 capacitor.config.json。');
        } else {
            console.warn('⚠️ build.config.js 中未完整配置 Android 签名信息，将跳过 Android 签名配置写入 capacitor.config.json。');
        }


        // TODO: 添加 iOS 专属的 buildOptions 到 capacitor.config.json (如果需要)
        // 同样，移除对 buildConfig.platforms.ios.enabled 的依赖，只要 iOS 配置存在就尝试写入
        if (iosConfig && iosConfig.p12Path && iosConfig.p12Password && iosConfig.provisioningProfile) {
            if (!capConfig.ios) capConfig.ios = {};
            capConfig.ios.preferredContentMode = 'mobile';
            if (!capConfig.ios.buildOptions) capConfig.ios.buildOptions = {};

            capConfig.ios.buildOptions = {
                signingCertificate: iosConfig.p12Path,
                provisioningProfile: iosConfig.provisioningProfile,
            };
            console.log('✅ Capacitor iOS 构建配置已写入 capacitor.config.json。');
        } else {
            console.warn('⚠️ build.config.js 中未完整配置 iOS 构建信息，将跳过 iOS 构建配置写入 capacitor.config.json。');
        }


        // 将更新后的配置写回文件
        await fs.writeFile(capConfigPath, JSON.stringify(capConfig, null, 2), 'utf8');
        console.log(`✅ 已更新 ${capConfigPath}`);
    } catch (error) {
        console.error(`❌ 更新 ${capConfigPath} 时出错: ${error.message}`);
        throw error; // 抛出错误，让调用者处理
    }

    // --- 2. 添加原生平台 (不再检查 buildConfig.platforms.android.enabled) ---
    // 无条件尝试添加 Android 平台，如果已存在，Capacitor 会跳过
    const androidPlatformDir = config.ANDROID_DIR;
    if (!await fs.access(androidPlatformDir).then(() => true).catch(() => false)) {
        console.log(`\n🤖 Android 平台目录不存在 (${androidPlatformDir})。尝试运行 "npx cap add android"...`);
        try {
            await execa('npx', ['cap', 'add', 'android'], { stdio: 'inherit', cwd: config.PROJECT_ROOT });
            console.log('✅ "npx cap add android" 执行成功。');
        } catch (error) {
            console.error(`❌ 无法添加 Android 平台: ${error.message}`);
            console.error("请检查你的 Android SDK 环境配置。");
            throw error;
        }
    } else {
        console.log(`✅ Android 平台目录已存在: ${androidPlatformDir}`);
    }

    // 无条件尝试添加 iOS 平台，如果已存在，Capacitor 会跳过
    const iosPlatformDir = config.IOS_DIR;
    if (!await fs.access(iosPlatformDir).then(() => true).catch(() => false)) {
        console.log(`\n🍎 iOS 平台目录不存在 (${iosPlatformDir})。尝试运行 "npx cap add ios"...`);
        try {
            await execa('npx', ['cap', 'add', 'ios'], { stdio: 'inherit', cwd: config.PROJECT_ROOT });
            console.log('✅ "npx cap add ios" 执行成功。');
        } catch (error) {
            console.error(`❌ 无法添加 iOS 平台: ${error.message}`);
            console.error("请检查你的 Xcode 环境配置。");
            throw error;
        }
    } else {
        console.log(`✅ iOS 平台目录已存在: ${iosPlatformDir}`);
    }

    try{
        console.log('\n开始初始化并安装插件');
        await installCapacitorPluginsSmartly();
        console.log('✅ 所有插件均已安装。');
    }catch (error) {
        console.error(`❌ 插件安装失败: ${error.message}`);
        throw error;
    }



    // --- 3. 执行 Capacitor 同步命令 ---
    try {
        console.log('\nRunning npx cap sync to synchronize web assets and plugins...');
        await execa('npx', ['cap', 'sync'], { stdio: 'inherit', cwd: config.PROJECT_ROOT });
        console.log('✅ Capacitor sync 完成。');
    } catch (error) {
        console.error(`❌ 执行 "npx cap sync" 时出错: ${error.message}`);
        throw error;
    }

    console.log('✨ 基础项目预处理完成。');
}

/**
 * 解析 `npx cap ls` 的纯文本输出，提取插件名称。
 * @param {string} rawOutput `npx cap ls` 的原始字符串输出。
 * @returns {Set<string>} 插件名称的 Set 集合。
 */
function parseCapLsOutput(rawOutput) {
    const plugins = new Set();
    const lines = rawOutput.split('\n');

    // 遍历每一行，查找符合插件命名模式的行
    for (const line of lines) {
        const parts = line.split('@'); // ['','capacitor/share','7.0.1']
        if (parts && parts[1]) {
            plugins.add(`@${parts[1]}`); // 添加插件名称（不带版本号）
        }
    }
    return plugins;
}
/**
 * 获取当前 Capacitor 项目中已安装的插件列表。
 * @param {string} projectRoot 项目根目录。
 * @returns {Promise<Set<string>>} 已安装插件名称的 Set 集合。
 */
async function getInstalledCapacitorPlugins(projectRoot) {
    try {
        const { stdout } = await execa('npx', ['cap', 'ls'], { cwd: projectRoot }); // 不使用 --json flag

        // 粗略地分割 Android 和 iOS 的输出块，然后分别解析
        const androidOutputBlock = stdout.split('Capacitor plugins for android:')[1];
        const iosOutputBlock = stdout.split('Capacitor plugins for ios:')[1];

        let androidPlugins = new Set();
        let iosPlugins = new Set();

        if (androidOutputBlock) {
            // Android 部分通常在 iOS 部分之前，或在 "Listing plugins for web" 之前
            const androidRelevantLines = androidOutputBlock.split('[info] Found')[0] || androidOutputBlock.split('[info] Listing plugins for web is not possible.')[0];
            androidPlugins = parseCapLsOutput(androidRelevantLines);
        }

        if (iosOutputBlock) {
            // iOS 部分通常在 "Listing plugins for web" 之前
            const iosRelevantLines = iosOutputBlock.split('[info] Listing plugins for web is not possible.')[0] || iosOutputBlock;
            iosPlugins = parseCapLsOutput(iosRelevantLines);
        }

        // 合并两个平台的插件集合
        return new Set([...androidPlugins, ...iosPlugins]);

    } catch (error) {
        console.error(`❌ 获取已安装 Capacitor 插件列表时出错: ${error.message}`);
        // 如果出错，返回空集合以防止后续问题。
        return new Set();
    }
}

/**
 * 智能安装 Capacitor 插件：只安装和添加缺失的插件，并过滤掉不存在的插件。
 */
async function installCapacitorPluginsSmartly() {
    // 合并所有期望的插件列表并去重
    const desiredPlugins = new Set([
        ...buildConfig.plugins,
        ...config.BASE_PLUGIN
    ]);
    const desiredPluginsArray = Array.from(desiredPlugins);

    console.log(`\n🔄 正在检查和安装 Capacitor 插件...`);
    console.log(`   期望安装的插件: ${desiredPluginsArray.join(', ')}`);

    const installedPlugins = await getInstalledCapacitorPlugins(config.PROJECT_ROOT);
    console.log(`   当前已安装的插件: ${Array.from(installedPlugins).join(', ')}`);

    const pluginsToInstall = [];
    const pluginsAlreadyPresent = [];
    const pluginsNotFoundInNpm = [];

    for (const plugin of desiredPluginsArray) {
        if (installedPlugins.has(plugin)) {
            pluginsAlreadyPresent.push(plugin);
             console.log(`✅ 插件 "${plugin}" 已存在，跳过安装。`);
            continue;
        }

        // 检查 npm 包是否存在于注册表中，避免安装不存在的插件
        try {
            // 使用 npm view 检查包是否存在，但不安装。stdout 不打印
            await execa('npm', ['view', plugin, 'version'], { stdio: 'pipe' });
            pluginsToInstall.push(plugin);
        } catch (error) {
            console.warn(`⚠️ 警告: npm 注册表中找不到插件 "${plugin}"。已从安装列表中移除。`);
            pluginsNotFoundInNpm.push(plugin);
        }
    }

    if (pluginsAlreadyPresent.length > 0) {
        console.log(`   ${pluginsAlreadyPresent.length} 个插件已存在并跳过: ${pluginsAlreadyPresent.join(', ')}`);
    }

    if (pluginsNotFoundInNpm.length > 0) {
        console.log(`   ${pluginsNotFoundInNpm.length} 个插件在 npm 中不存在并已移除: ${pluginsNotFoundInNpm.join(', ')}`);
    }

    if (pluginsToInstall.length === 0) {
        console.log('✨ 所有期望的 Capacitor 插件都已安装。');
        return;
    }

    console.log(`\n⬇️ 正在安装 ${pluginsToInstall.length} 个新插件: ${pluginsToInstall.join(', ')}\n`);

    for (const plugin of pluginsToInstall) {
        try {
            console.log(`   - 正在将 Capacitor 插件添加到项目: ${plugin}...`);
            // cap add 是幂等的，即使 npm install 成功但 cap add 失败过，这里会重试
            await execa('npx', ['cap', 'add', plugin], { stdio: 'inherit', cwd: config.PROJECT_ROOT });

            console.log(`✅ 插件 "${plugin}" 安装并添加到项目成功！`);
        } catch (error) {
            console.error(`❌ 安装或添加 Capacitor 插件 "${plugin}" 时出错: ${error.message}`);
            // 如果一个插件安装失败，这里选择继续处理其他插件
        }
    }
    await execa('npx', ['cap', 'sync'], { stdio: 'inherit', cwd: config.PROJECT_ROOT });
    console.log('\n🔌 Capacitor 插件安装/检查完成。');
}
export { basePreProcess };