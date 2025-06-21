// bin/scripts/android-pre.js
import fs from 'node:fs/promises'; // 统一使用 fs.promises 进行异步文件操作
import path from 'node:path';
import xml2js from 'xml2js';
import sharp from 'sharp'; // 确保你已经安装了 sharp: npm install sharp
import {execa} from 'execa'; // 用于执行命令行命令：npm install execa

// 移除了 ANDROID_SDK 的导入，因为它不再在此文件中使用。
import {buildConfig} from '../../build.config.js';
import config from "../config.js";
import {variablesGradle} from "../utils/gradle.js";
import {initAndroidManifestUtils} from "../utils/androidManifest.js"; // 导入一体化配置文件


/**
 * 生成 Android 应用的多尺寸图标。
 */
async function generateAndroidIcons() {
    console.log(`🎨 正在生成 Android 应用图标...`);

    try {
        const iconInputPath = path.resolve(config.PROJECT_ROOT, './assets');

        // 确保源文件存在，使用 fs.access 替代 fs.existsSync
        try {
            await fs.access(iconInputPath); // 尝试访问，如果文件不存在会抛出错误
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`❌ 图标源文件夹不存在: ${iconInputPath}`);
                console.log(`✅ - 跳过图标生成。`);
                return;
            }
            throw error; // 其他错误继续抛出
        }

        const files = await fs.readdir(iconInputPath); // 使用 fs.readdir (Promise 版本)
        if (!files.includes('splash.png') || !files.includes('splash-dark.png')
            || !files.includes('icon-only.png') || !files.includes('icon-foreground.png') || !files.includes('icon-background.png')) {
            console.error(`❌ 请确保在 ${iconInputPath} 目录存在以下五个文件`);
            console.error(`  - splash.png -splash-dark.png -icon-only.png -icon-foreground.png -icon-background.png`);
            return;
        }
        const capBuildArgs = ['capacitor-assets', 'generate', '--android','--verbose']
        console.log('✅ 开始生成 Android 应用图标！');
        await execa('npx', capBuildArgs, {stdio: 'ignore', cwd: config.PROJECT_ROOT}); // 确保 cwd
        console.log('✅ Android 应用图标生成成功！');
    } catch (error) {
        console.log(error)
        console.error(`❌ 生成 Android 图标时出错: ${error.message}`);
        // 原始代码中这里没有 throw error 或 process.exit(1)，为了保持行为一致性，这里不添加
    }
}




/**
 * 执行 Android 平台特定的预处理逻辑。
 * 此函数现在只包含 Android 平台特有的文件修改，
 * 通用 Capacitor 命令（如 `npx cap add android` 和 `npx cap sync`）
 * 和 `capacitor.config.json` 的更新已移至 `base-pre.js`。
 */
async function androidPreProcess() {
    console.log('✨ 开始 Android 项目预处理...');

    const androidPlatformDir = config.ANDROID_DIR; // 这是 android 目录的绝对路径
    const assetsDir = path.join(androidPlatformDir, 'app', 'src', 'main', 'assets');


    // 1. 确保 Android 平台目录存在
    // 这个检查和 'npx cap add android' 的执行现在主要由 base-pre.js 负责。
    // 这里仅做一个存在性确认。
    try {
        await fs.access(androidPlatformDir); // 使用 fs.access 异步检查
        console.log(`✅ Android 平台目录已存在: ${androidPlatformDir}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`❌ Android 平台目录不存在: ${androidPlatformDir}。请确保已运行基础预处理并成功添加 Android 平台。`);
            throw new Error('Android 平台目录缺失。');
        }
        throw error; // 其他错误继续抛出
    }


    // 2. 确保 assets 目录存在
    try {
        await fs.mkdir(assetsDir, {recursive: true}); // 使用 fs.mkdir (Promise 版本)
        console.log(`✅ 确保 assets 目录存在: ${assetsDir}`);
    } catch (error) {
        console.error(`❌ 无法创建 assets 目录: ${error.message}`);
        process.exit(1);
    }


    // 不需要执行同步,因为 npx add xxx 已经执行了 sync
    // await execa('npx', ['cap','sync','android'], {stdio: 'inherit', cwd: config.PROJECT_ROOT});

    // --- 5. 根据所选插件修改原生项目代码 ---
    await initPluginsFile()

    // --- 6. 生成 Android 图标 ---
    await generateAndroidIcons();


    console.log('✨ Android 项目预处理完成。');
}

async function initPluginsFile() {
    /**
     * 忽略, 因为已经通过 cap add XXX 和 cap sync 已经执行了集成了
     *
    console.log('开始初始化插件文件')
    //variablesGradle('androidxMaterialVersion','1.12.0')


    // @capacitor/app
    // https://capacitorjs.com/docs/apis/app
    const manifestUtils = initAndroidManifestUtils(config.ANDROID_DIR);
    await manifestUtils.addDataToIntentFilter('.MainActivity', [
        '<action android:name="android.intent.action.VIEW" />',
        '<category android:name="android.intent.category.DEFAULT" />',
        '<category android:name="android.intent.category.BROWSABLE" />',
        '<data android:scheme="@string/custom_url_scheme" />'
    ])

    // @capacitor/background-runner
    // https://capacitorjs.com/docs/apis/background-runner





    //相机不是必须的
    await manifestUtils.addUsesFeature('android.hardware.camera', false);
    variablesGradle('androidxExifInterfaceVersion', '1.3.7')
    variablesGradle('androidxMaterialVersion', '1.12.0')

    //@capacitor/browser
    //https://capacitorjs.com/docs/apis/browser
    variablesGradle('androidxBrowserVersion', '1.8.0')

    //local-notifications 本地通知
    //https://capacitorjs.com/docs/apis/local-notifications
    await manifestUtils.addPermission('android.permission.SCHEDULE_EXACT_ALARM')


    // @capacitor/splash-screen 启动画面
    // https://capacitorjs.com/docs/apis/splash-screen


    */
}

export {androidPreProcess};