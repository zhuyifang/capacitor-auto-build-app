// bin/scripts/android-build.js
import { execa } from 'execa'; // 确保已安装 execa
import path from 'node:path';
import fs from 'node:fs/promises'; // 统一使用 fs.promises
import { buildConfig } from '../../build.config.js'; // 导入你的构建配置
import config from '../config.js'; // 导入你的通用配置

/**
 * 获取最新版本的 Android Build-Tools。
 * @param {string} androidSdkRoot - Android SDK 的根目录路径。
 * @returns {Promise<string>} 最新 Build-Tools 版本的字符串。
 */
async function getLatestBuildToolsVersion(androidSdkRoot) {
    const buildToolsPath = path.join(androidSdkRoot, 'build-tools');
    const versions = await fs.readdir(buildToolsPath); // 使用 fs.readdir (Promise 版本)

    // 过滤掉非版本号目录，并按版本号降序排序，找到最新的版本
    versions.sort((a, b) => {
        // 简单版本号比较，处理 '30.0.3', '31.0.0-rc1' 等
        const parseVersion = (v) => v.split('.').map(Number);
        const pa = parseVersion(a);
        const pb = parseVersion(b);

        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const va = pa[i] || 0;
            const vb = pb[i] || 0;
            if (va < vb) return 1;
            if (va > vb) return -1;
        }
        return 0;
    });

    // 返回最新版本
    return versions[0];
}

/**
 * 格式化日期和时间，用于文件名。
 * @param {Date} date - 日期对象。
 * @param {string} format - 格式字符串，支持 YYYY, MM, DD, HH, mm, ss。
 * @returns {string} 格式化后的字符串。
 */
function formatDateTime(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
        .replace(/YYYY/g, year)
        .replace(/MM/g, month)
        .replace(/DD/g, day)
        .replace(/HH/g, hours)
        .replace(/mm/g, minutes)
        .replace(/ss/g, seconds);
}

/**
 * 构建 Android 项目。
 * @param {boolean} shouldBuild 是否执行构建。
 * @param {Array<string>} cliArgs 命令行参数。
 */
async function androidBuild(shouldBuild, cliArgs) {
    if (!shouldBuild) {
        console.log('⚠️  跳过 Android 构建。');
        return;
    }

    const appInfo = buildConfig.app;
    const androidConfig = buildConfig.android;
    const outputConfig = buildConfig.output;

    try {
        // --- 1. 执行 npx cap build android ---
        console.log('🤖 正在构建 Android 项目...');
        const buildArgs = ['cap', 'build', 'android'];

        // 检查是否需要添加额外的构建参数
        if (cliArgs.includes('--prod')) {
            buildArgs.push('--prod');
        }

        await execa('npx', buildArgs, { cwd: config.PROJECT_ROOT, stdio: 'inherit' });
        console.log('✅ Android 项目构建成功。');

        // --- 2. 将生成的 APK 复制到指定目录 ---
        console.log('📂 正在复制 APK 到指定目录...');
        
        // 确定源 APK 路径
        const apkDir = path.join(config.PROJECT_ROOT, 'android/app/build/outputs/apk/release');
        let sourceApkPath = path.join(apkDir, 'app-release.apk');
        
        // 检查 APK 是否存在，如果不存在则检查签名版本
        try {
            await fs.access(sourceApkPath);
        } catch (error) {
            // 检查签名版本
            const signedApkPath = path.join(apkDir, 'app-release-signed.apk');
            try {
                await fs.access(signedApkPath);
                sourceApkPath = signedApkPath;
            } catch (signedError) {
                // 列出目录中的所有 APK 文件以帮助调试
                try {
                    const files = await fs.readdir(apkDir);
                    const apkFiles = files.filter(file => file.endsWith('.apk'));
                    console.log('📁 APK 目录中的文件:', apkFiles);
                } catch (dirError) {
                    console.log('❌ 无法读取 APK 目录:', dirError.message);
                }
                
                throw new Error(`生成的 APK 文件不存在: ${sourceApkPath} 或 ${signedApkPath}`);
            }
        }

        // 格式化目标文件名
        const date = new Date();
        const formattedApkName = outputConfig.androidApkNameFormat
            .replace(/{versionName}/g, appInfo.versionName)
            .replace(/{buildNumber}/g, appInfo.buildNumber)
            .replace(/{date}/g, formatDateTime(date, 'YYYYMMDD'))
            .replace(/{time}/g, formatDateTime(date, 'HHmmss'));

        // 确定目标路径 - 按照要求使用 displayName 作为子目录
        const targetDir = path.join(config.PROJECT_ROOT, outputConfig.artifactsDir, appInfo.displayName);
        const targetApkPath = path.join(targetDir, formattedApkName);

        // 确保目标目录存在
        await fs.mkdir(targetDir, { recursive: true });

        // 复制 APK 文件
        await fs.copyFile(sourceApkPath, targetApkPath);
        console.log(`✅ APK 已复制到: ${targetApkPath}`);

    } catch (error) {
        console.error(`❌ Android 打包失败: ${error.message}`);
        throw error;
    }
}

export { androidBuild };