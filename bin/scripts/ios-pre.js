// bin/scripts/ios-pre.js
import fs from 'node:fs/promises';
import path from 'node:path';
import xml2js from 'xml2js'; // 如果您需要在 iOS 中解析 XML，可能需要它，但 Info.plist 通常是 Plist 格式，更推荐 'plist' 库
import { execa } from 'execa'; // 用于执行命令行命令

import { buildConfig } from '../../build.config.js';
import config from "../config.js"; // 假设 config.js 中有 IOS_DIR

/**
 * 生成 iOS 应用的多尺寸图标和启动画面。
 */
async function generateIosAssets() {
    console.log(`🎨 正在生成 iOS 应用图标和启动画面...`);

    try {
        const assetsInputPath = path.resolve(config.PROJECT_ROOT, './assets');

        // 确保源文件存在
        try {
            await fs.access(assetsInputPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`❌ 资产源文件夹不存在: ${assetsInputPath}`);
                console.log(`✅ - 跳过 iOS 资产生成。`);
                return;
            }
            throw error;
        }

        // 检查所需文件是否存在（这里假设与 Android 类似，需要 splash 和 icon 相关文件）
        const files = await fs.readdir(assetsInputPath);
        if (!files.includes('splash.png') || !files.includes('splash-dark.png') ||
            !files.includes('icon-only.png') || !files.includes('icon-foreground.png') || !files.includes('icon-background.png')) {
            console.error(`❌ 请确保在 ${assetsInputPath} 目录存在以下五个文件用于 iOS 资产生成:`);
            console.error(`  - splash.png - splash-dark.png - icon-only.png - icon-foreground.png - icon-background.png`);
            // 如果缺少文件，仍然尝试执行 capacitor-assets，让它报告具体错误
        }

        const capAssetsArgs = ['capacitor-assets', 'generate', '--ios', '--verbose'];
        console.log('✅ 开始生成 iOS 应用图标和启动画面！');
        await execa('npx', capAssetsArgs, { stdio: 'inherit', cwd: config.PROJECT_ROOT }); // 确保 cwd 是项目根目录
        console.log('✅ iOS 应用图标和启动画面生成成功！');
    } catch (error) {
        console.error(`❌ 生成 iOS 资产时出错: ${error.message}`);
        // 这里的错误处理可以根据您的需求决定是否抛出或退出进程
    }
}

/**
 * 执行 iOS 平台特定的预处理逻辑。
 */
async function iosPreProcess() {
    console.log('✨ 开始 iOS 项目预处理...');

    const iosPlatformDir = config.IOS_DIR; // 这是 iOS 目录的绝对路径
    // Info.plist 通常在 ios/App/App/Info.plist，需要进一步确认您的项目结构
    const infoPlistPath = path.join(iosPlatformDir, 'App', 'App', 'Info.plist');

    // 1. 确保 iOS 平台目录存在
    try {
        await fs.access(iosPlatformDir);
        console.log(`✅ iOS 平台目录已存在: ${iosPlatformDir}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`❌ iOS 平台目录不存在: ${iosPlatformDir}。请确保已运行基础预处理并成功添加 iOS 平台。`);
            throw new Error('iOS 平台目录缺失。');
        }
        throw error;
    }

    // 2. 确保 Info.plist 文件存在 (Capacitor 项目通常会有)
    try {
        await fs.access(infoPlistPath);
        console.log(`✅ Info.plist 文件已存在: ${infoPlistPath}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`❌ Info.plist 文件不存在: ${infoPlistPath}。请检查您的 iOS 项目结构。`);
            throw new Error('Info.plist 文件缺失。');
        }
        throw error;
    }

    // 3. 执行 Pod install
    console.log('📦 正在执行 pod install');
    try {
        await execa('pod', ['install'], {
            cwd: path.join(iosPlatformDir, 'App'), // 在 iOS 平台目录执行 pod install
            stdio: 'inherit',
        });
        console.log('✅ Pod install 完成。');
    } catch (error) {
        console.error(`❌ Pod install 失败: ${error.message}`);
        throw error;
    }

    // 4. 生成 iOS 图标和启动画面
    await generateIosAssets();

    // 5. 根据所选插件修改原生项目代码 (例如修改 Info.plist)
    // 这一步需要更具体的信息，因为您没有提供 iOS 插件的修改细节
    // 对于 Info.plist 的修改，通常需要使用像 'plist' 这样的库来解析和写入 .plist 文件
    console.log('ℹ️ 跳过 iOS 插件特定文件修改，因为缺少具体配置细节。');

    console.log('✨ iOS 项目预处理完成。');
}

export { iosPreProcess };