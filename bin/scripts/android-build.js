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

    const latestVersion = versions[0];
    if (!latestVersion) {
        throw new Error('未找到任何 Android Build-Tools 版本。');
    }
    return latestVersion;
}

/**
 * 执行 Android 应用的打包构建。
 * @param {boolean} shouldBuild - 是否执行实际的 `npx cap build` 命令。
 * @param {string[]} cliArgs - 传递给主脚本的原始命令行参数。
 */
async function androidBuild(shouldBuild, cliArgs) {
    if (!shouldBuild) {
        console.log('ℹ️ 未检测到 --build 参数，跳过 Android 打包阶段。');
        return;
    }

    console.log('\n📦 开始打包 Android APK/AAB...');

    const capBuildArgs = ['cap', 'build', 'android'];

    // --- 解决 apksigner ENOENT 问题的关键：构建并传递完整的 PATH 环境变量 ---
    const androidSdkRoot = process.env.ANDROID_HOME;

    if (!androidSdkRoot) {
        console.error('❌ 环境变量 ANDROID_HOME 未设置。无法找到 Android SDK 工具。');
        console.error('请确保 ANDROID_HOME 指向你的 Android SDK 根目录。');
        process.exit(1);
    }
    console.log(`ℹ️ 检测到 ANDROID_HOME: ${androidSdkRoot}`);

    let latestBuildToolsVersion = '';
    try {
        latestBuildToolsVersion = await getLatestBuildToolsVersion(androidSdkRoot); // 调用辅助函数
        console.log(`ℹ️ 已检测到最新 Android Build-Tools 版本: ${latestBuildToolsVersion}`);
    } catch (error) {
        console.error(`❌ 无法自动检测 Build-Tools 版本: ${error.message}`);
        console.error("请确保 Android SDK 安装完整，且 Build-Tools 目录存在有效版本。");
        process.exit(1);
    }

    // 构建自定义 PATH，确保 platform-tools 和 build-tools 路径在前
    const customPath = [
        path.join(androidSdkRoot, 'platform-tools'),
        path.join(androidSdkRoot, 'build-tools', latestBuildToolsVersion),
        process.env.PATH // 继承现有的 PATH
    ].filter(Boolean) // 过滤掉空值，以防某个路径不存在
        .join(path.delimiter); // 使用系统特定的路径分隔符 (例如 macOS/Linux 是 ':', Windows 是 ';')

    // 创建传递给子进程的环境变量对象
    const envForChildProcess = {
        ...process.env, // 继承所有其他环境变量
        ANDROID_HOME: androidSdkRoot, // 显式设置 ANDROID_HOME，Gradle 可能会用到
        PATH: customPath,             // 覆盖子进程的 PATH
    };

    try {
        console.log(`🚀 执行 Gradle Sync 命令: ./gradlew build`);
        await execa('./gradlew',['build'],{cwd: config.ANDROID_DIR,stdio: 'inherit',env:envForChildProcess})
        console.log(`🚀 执行 Capacitor Build 命令: npx ${capBuildArgs.join(' ')}`);
        await execa('npx', capBuildArgs, {
            stdio: 'inherit', // 将子进程的输出直接传递给父进程
            cwd: config.PROJECT_ROOT, // 在项目根目录执行命令
            env: envForChildProcess // 传递包含正确 PATH 的环境变量
        });
        console.log(`\n✅ Android 打包完成！`);
    } catch (error) {
        console.error(`❌ Android 打包失败: ${error.message}`);
        throw error; // 重新抛出错误，由主函数捕获
    }
}

export { androidBuild };