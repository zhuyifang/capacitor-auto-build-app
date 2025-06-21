// bin/build-app.js
import {basePreProcess} from './scripts/base-pre.js'; // 导入基础预处理
import {androidPreProcess} from './scripts/android-pre.js'; // 导入 Android 预处理
// import { iosPreProcess } from './scripts/ios-pre.js'; // 假设未来会有 iOS 预处理
import {androidBuild} from './scripts/android-build.js';
import {iosBuild} from "./scripts/ios-build.js";
import {iosPreProcess} from "./scripts/ios-pre.js"; // 导入新的 Android 打包模块

/**
 * 执行应用程序的完整打包流程。
 * 流程包括：
 * 1. 基础预处理 (通用配置、条件添加原生平台、npx cap sync)。
 * 2. 平台特定预处理 (修改 AndroidManifest.xml, build.gradle 等)。
 * 3. 平台特定打包。
 */
async function main() {
    // 捕获所有传递给此脚本的命令行参数（跳过 node 和脚本文件路径）
    const cliArgs = process.argv.slice(2);

    // 第一个参数是目标平台
    const targetPlatform = cliArgs[0];

    if (!targetPlatform) {
        console.error('❌ 请指定要构建的平台：node bin/build-app.js <android|ios>');
        process.exit(1);
    }

    try {
        console.log(`\n🚀 启动 ${targetPlatform.toUpperCase()} 自动化打包流程...\n`);

        // --- 1. 基础预处理阶段 (通用，与平台无关) ---
        await basePreProcess();

        console.log('\n--- 基础预处理完成，进入平台特定预处理阶段 ---\n');

        // --- 2. 平台特定预处理阶段 ---
        // 检查是否有 --build 参数，决定是否执行打包
        let shouldBuild = cliArgs.includes('--build');
        if (targetPlatform === 'android' || !targetPlatform) {
            await startAndroidBuild(shouldBuild, cliArgs)
        } else if (targetPlatform === 'ios' || !targetPlatform) {
           await startIosBuild(shouldBuild, cliArgs)
        } else {
            await startIosBuild(shouldBuild, cliArgs);
            await startAndroidBuild(shouldBuild, cliArgs);
        }

        console.log(`\n🎉 ${targetPlatform.toUpperCase()} 自动化打包流程成功完成！`);

    } catch (error) {
        console.error(`\n❌ ${targetPlatform.toUpperCase()} 自动化打包流程失败: ${error.message}`);
        // 确保在出错时也退出，传递非零状态码
        process.exit(1);
    }
}
async function startIosBuild(shouldBuild,cliArgs){
    await iosPreProcess();
    console.log('\n--- IOS 预处理完成，进入打包阶段 ---\n');

    if (shouldBuild) {
        console.log('检测到 --build 参数，开始打包正式版本。');
    }
    await iosBuild(shouldBuild, cliArgs);
}
async function startAndroidBuild(shouldBuild, cliArgs) {
    await androidPreProcess();
    console.log('\n--- Android 预处理完成，进入打包阶段 ---\n');

    if (shouldBuild) {
        console.log('检测到 --build 参数，开始打包正式版本。');
    }
    await androidBuild(shouldBuild, cliArgs);
}

// 运行主函数
main();