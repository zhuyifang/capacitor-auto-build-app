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

    // 如果是本地应用，需要处理本地资源
    if (appInfo.appType === 'local') {
        console.log('📁 处理本地 Web 资源...');
        // 将编译后的本地资源复制到 www 目录
        // 正确处理绝对路径和相对路径
        const localWebDir = path.isAbsolute(appInfo.localWebDir) 
            ? appInfo.localWebDir 
            : path.join(config.PROJECT_ROOT, appInfo.localWebDir);
        const webDir = path.join(config.PROJECT_ROOT, 'www');
        
        // 检查源目录是否存在
        try {
            await fs.access(localWebDir);
        } catch (error) {
            console.error(`❌ 本地编译目录不存在: ${localWebDir}`);
            throw error;
        }
        
        // 清空目标目录
        await fs.rm(webDir, { recursive: true, force: true });
        await fs.mkdir(webDir, { recursive: true });
        
        // 复制本地资源到 www 目录
        // 修复目录结构问题，确保正确复制文件
        try {
            // 使用 execa 执行复制命令，直接复制目录内容而不是目录本身
            await execa('cp', ['-r', path.join(localWebDir, '*'), webDir], { cwd: config.PROJECT_ROOT, shell: true });
        } catch (copyError) {
            // 如果 cp 命令失败，尝试使用 node.js 方法
            console.log('🔄 使用 Node.js 方法复制文件...');
            await copyDirContents(localWebDir, webDir);
        }
        
        // 验证复制是否成功
        try {
            await fs.access(path.join(webDir, 'index.html'));
            console.log('✅ 本地 Web 资源处理完成');
        } catch (error) {
            console.error(`❌ 复制后 www 目录中未找到 index.html 文件`);
            throw new Error('本地 Web 资源复制失败，缺少 index.html 文件');
        }
    }

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
        capConfig.webDir = 'www'; // 统一使用 www 目录
        
        // 根据应用类型设置 server 配置
        if (appInfo.appType === 'pwa') {
            capConfig.server = {
                url: appInfo.startUrl,
                hostname: new URL(appInfo.startUrl).hostname,
                androidScheme: appInfo.scheme,
                iosScheme: appInfo.scheme,
                allowNavigation: [new URL(appInfo.startUrl).hostname],
                allowMixedContent: true,
                cleartext: true,
                errorPath: "error.html"
            };
        } else {
            // 本地应用不需要 server 配置
            delete capConfig.server;
        }
        
        // 更新 Android 构建选项
        if (!capConfig.android) {
            capConfig.android = {};
        }
        if (!capConfig.android.buildOptions) {
            capConfig.android.buildOptions = {};
        }
        
        // 使用 build.config.js 中的 Android 配置
        capConfig.android.buildOptions = {
            keystorePath: androidConfig.keystorePath,
            keystorePassword: androidConfig.keystorePassword,
            keystoreAlias: androidConfig.keyAlias,
            keystoreAliasPassword: androidConfig.keyPassword,
            releaseType: "APK",
            signingType: "apksigner"
        };
        
        // 更新 iOS 构建选项，但保留原有结构
        if (!capConfig.ios) {
            capConfig.ios = {};
        }
        if (!capConfig.ios.buildOptions) {
            capConfig.ios.buildOptions = {};
        }
        
        // 仅更新必要的配置项，保留其他可能需要的配置
        capConfig.ios.buildOptions.signingCertificate = iosConfig.p12Path;
        capConfig.ios.buildOptions.provisioningProfile = iosConfig.provisioningProfile;
        capConfig.ios.buildOptions.certificatePassword = iosConfig.p12Password;
        
        capConfig.ios.preferredContentMode = "mobile";

        // 保存更新后的配置
        await fs.writeFile(capConfigPath, JSON.stringify(capConfig, null, 2));
        console.log('✅ Capacitor 配置文件更新成功。');
    } catch (error) {
        console.error(`❌ 更新 Capacitor 配置文件失败: ${error.message}`);
        throw error;
    }

    // --- 2. 添加原生平台 (如果尚未添加) ---
    console.log('📱 检查并添加原生平台...');
    try {
        // 检查 Android 平台
        const androidDir = path.join(config.PROJECT_ROOT, 'android');
        const androidExists = await fs.access(androidDir).then(() => true).catch(() => false);
        if (!androidExists) {
            console.log('  ➕ 正在添加 Android 平台...');
            await execa('npx', ['cap', 'add', 'android'], { cwd: config.PROJECT_ROOT, stdio: 'inherit' });
        } else {
            console.log('  ✅ Android 平台已存在。');
        }

        // 检查 iOS 平台
        const iosDir = path.join(config.PROJECT_ROOT, 'ios');
        const iosExists = await fs.access(iosDir).then(() => true).catch(() => false);
        if (!iosExists) {
            console.log('  ➕ 正在添加 iOS 平台...');
            await execa('npx', ['cap', 'add', 'ios'], { cwd: config.PROJECT_ROOT, stdio: 'inherit' });
        } else {
            console.log('  ✅ iOS 平台已存在。');
        }
    } catch (error) {
        console.error(`❌ 添加原生平台失败: ${error.message}`);
        throw error;
    }

    // --- 3. 执行 npx cap sync ---
    console.log('🔄 正在同步原生平台配置...');
    try {
        await execa('npx', ['cap', 'sync'], { cwd: config.PROJECT_ROOT, stdio: 'inherit' });
        console.log('✅ 原生平台同步成功。');
    } catch (error) {
        console.error(`❌ 原生平台同步失败: ${error.message}`);
        throw error;
    }

    console.log('🎉 基础预处理完成。');
}

/**
 * 递归复制目录内容的辅助函数
 * @param {string} src - 源目录路径
 * @param {string} dest - 目标目录路径
 */
async function copyDirContents(src, dest) {
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            await fs.mkdir(destPath, { recursive: true });
            await copyDirContents(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

export { basePreProcess };