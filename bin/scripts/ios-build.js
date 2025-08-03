// bin/scripts/ios-build.js
import {execa} from 'execa';
import path from 'node:path';
import fs from 'node:fs/promises';
import plist from 'plist'; // 用于解析 .mobileprovision 文件

import {buildConfig} from '../../build.config.js'; // 导入您的构建配置
import config from '../config.js';
import {fixXcodeProject, modifyXcodeProjectSetting} from "../utils/pbxproj.js"; // 导入您的通用配置

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
 * 从描述文件 (mobileprovision) 中提取 Team ID。
 * @param {string} mobileProvisionFilePath 描述文件的完整路径。
 * @returns {Promise<object>} {teamId, profileName}
 */
async function getTeamIdFromProvisioningProfile(mobileProvisionFilePath) {
    try {
        // 读取文件内容
        const fileContent = await fs.readFile(mobileProvisionFilePath, 'utf8');

        // .mobileprovision 文件实际上是签名过的 XML，但在开始和结束有额外的二进制数据
        // XML 内容通常在 "<plist>" 和 "</plist>" 标签之间
        const plistStart = fileContent.indexOf('<plist version="1.0">');
        const plistEnd = fileContent.indexOf('</plist>') + '</plist>'.length;

        if (plistStart === -1 || plistEnd === -1) {
            console.error('错误: 未在描述文件中找到 plist 结构。');
            return {teamId: null, profileName: null};
        }

        const plistContent = fileContent.substring(plistStart, plistEnd);

        // 使用 'plist' 库解析 XML
        const parsedPlist = plist.parse(plistContent);

        let teamId = null;
        if (parsedPlist.TeamIdentifier && parsedPlist.TeamIdentifier.length > 0) {
            teamId = parsedPlist.TeamIdentifier[0];
        }

        const profileName = parsedPlist.Name || null;
        const applicationIdentifier = parsedPlist['application-identifier'] || null;
        return {teamId, profileName, applicationIdentifier};

    } catch (error) {
        console.error(`读取或解析描述文件失败: ${mobileProvisionFilePath}`);
        console.error(error);
        return {teamId: null, profileName: null};
    }
}

/**
 * 执行 iOS 应用的打包构建。
 * @param {boolean} shouldBuild - 是否执行实际的构建命令。
 * @param {string[]} cliArgs - 传递给主脚本的原始命令行参数。
 */
async function iosBuild(shouldBuild, cliArgs) {
    if (!shouldBuild) {
        console.log('ℹ️ 未检测到 --build 参数，跳过 iOS 打包阶段。');
        return;
    }

    console.log('\n📦 开始打包 iOS 应用...');

    // 1. 环境检测，非mac退出
    if (process.platform !== 'darwin') {
        console.error('❌ iOS 打包只能在 macOS 系统上执行。当前系统为:', process.platform);
        process.exit(1);
    }
    console.log('✅ 操作系统检测：macOS。');

    const iosPlatformDir = config.IOS_DIR;
    const projectRoot = config.PROJECT_ROOT;

    // 从 buildConfig 中获取 iOS 打包配置
    const iosBuildConfig = buildConfig.ios;
    const appConfig = buildConfig.app;
    const outputConfig = buildConfig.output;

    if (!iosBuildConfig || !appConfig || !outputConfig) {
        console.error('❌ buildConfig.js 中缺少必要的配置 (ios, app, 或 output)。');
        process.exit(1);
    }

    const {
        p12Path,
        p12Password,
        provisioningProfile,
    } = iosBuildConfig;

    const {displayName, versionName, buildNumber} = appConfig;
    const {artifactsDir, iosIpaNameFormat} = outputConfig;

    // 2. 检查必要的配置项
    if (!p12Path || !p12Password || !provisioningProfile) {
        console.error('❌ iOS 打包配置不完整。请检查 buildConfig.ios 中是否包含 p12Path, p12Password, provisioningProfile。');
        process.exit(1);
    }
    if (!displayName || !versionName || !buildNumber) {
        console.error('❌ 应用基本信息配置不完整。请检查 buildConfig.app 中是否包含 displayName, versionName, buildNumber。');
        process.exit(1);
    }
    if (!artifactsDir || !iosIpaNameFormat) {
        console.error('❌ 输出路径配置不完整。请检查 buildConfig.output 中是否包含 artifactsDir, iosIpaNameFormat。');
        process.exit(1);
    }

    const fullP12Path = path.resolve(projectRoot, p12Path);
    // 假设描述文件在 'certificates' 目录下，与 p12Path 同级或在其中
    const fullProvisioningProfilePath = path.resolve(path.dirname(fullP12Path), provisioningProfile);


    // 检查 P12 证书和描述文件是否存在
    try {
        await fs.access(fullP12Path);
        console.log(`✅ P12 证书文件存在: ${fullP12Path}`);
    } catch (error) {
        console.error(`❌ P12 证书文件不存在: ${fullP12Path}`);
        process.exit(1);
    }
    try {
        await fs.access(fullProvisioningProfilePath);
        console.log(`✅ 描述文件存在: ${fullProvisioningProfilePath}`);
    } catch (error) {
        console.error(`❌ 描述文件不存在: ${fullProvisioningProfilePath}`);
        process.exit(1);
    }

    // 3. 读取 Team ID 从描述文件
    let teamId, profileName, applicationIdentifier;
    try {
        const profile = await getTeamIdFromProvisioningProfile(fullProvisioningProfilePath);
        teamId = profile.teamId;
        profileName = profile.profileName;
        applicationIdentifier = profile.applicationIdentifier;
    } catch (error) {
        console.error(`❌ 无法获取 Team ID，退出打包过程。`);
        process.exit(1);
    }

    // 4. 导入 P12 证书到临时钥匙串
    // 创建一个临时钥匙串来导入证书，避免污染默认钥匙串
    const keychainName = `temp_capacitor_keychain_${Date.now()}.keychain`;
    const keychainPath = path.join(process.env.HOME, 'Library', 'Keychains', keychainName);
    const keychainPassword = iosBuildConfig.p12Password; // 临时钥匙串的密码

    try {
        console.log(`🔑 正在创建临时钥匙串: ${keychainPath}`);
        await execa('security', ['create-keychain', '-p', keychainPassword, keychainPath], {stdio: 'inherit'});
        await execa('security', ['unlock-keychain', '-p', keychainPassword, keychainPath], {stdio: 'inherit'});
        // 将临时钥匙串添加到搜索路径的顶部，确保 Xcode 优先找到它
        await execa('security', ['list-keychains', '-s', keychainPath, 'login.keychain'], {stdio: 'inherit'});
        console.log('✅ 临时钥匙串创建并解锁成功。');

        console.log(`🔑 正在导入 P12 证书到临时钥匙串...`);
        // security import 命令导入 P12 证书到指定的钥匙串
        // -P 参数是 P12 证书的密码
        // -k 参数是钥匙串的路径
        // -A 允许访问，-T 指定信任的应用
        await execa('security', ['import', fullP12Path, '-P', p12Password, '-k', keychainPath, '-A', '-T', '/usr/bin/codesign', '-T', '/usr/bin/security'], {stdio: 'inherit'});
        // await execa(`security`, ['import', fullP12Path, '-k', 'login.keychain', '-P', p12Password, '-A']);

        // 设置钥匙串分区列表，减少或消除密码输入对话框
        await execa('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', keychainPassword, keychainPath], {stdio: 'inherit'});
        
        console.log('✅ P12 证书导入成功。');

        // 将描述文件复制到 Xcode 识别的目录
        const profilesDir = path.join(process.env.HOME, 'Library', 'MobileDevice', 'Provisioning Profiles');
        await fs.mkdir(profilesDir, {recursive: true});
        const destProvisioningProfilePath = path.join(profilesDir, path.basename(fullProvisioningProfilePath));
        await fs.copyFile(fullProvisioningProfilePath, destProvisioningProfilePath);
        console.log(`✅ 描述文件已复制到 Xcode 识别目录: ${destProvisioningProfilePath}`);

    } catch (error) {
        console.error(`❌ P12 证书导入或钥匙串配置失败: ${error.message}`);
        // 确保在出错时清理钥匙串
        try {
            await execa('security', ['delete-keychain', keychainPath], {stdio: 'ignore'});
            console.log('⚠️ 临时钥匙串已清理。');
        } catch (cleanupError) {
            console.error(`❌ 清理临时钥匙串失败: ${cleanupError.message}`);
        }
        process.exit(1);
    }

    // 确保 iOS 平台目录存在
    try {
        await fs.access(iosPlatformDir);
        console.log(`✅ iOS 平台目录已存在: ${iosPlatformDir}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`❌ iOS 平台目录不存在: ${iosPlatformDir}。请确保已运行预处理并成功添加 iOS 平台。`);
            process.exit(1);
        }
        throw error;
    }

    const xcworkspacePath = path.join(iosPlatformDir, 'App', 'App.xcworkspace');
    const xcodeprojPath = path.join(iosPlatformDir, 'App', 'App.xcodeproj');

    let projectOrWorkspaceArg = '';
    let projectOrWorkspacePath = '';

    try {
        await fs.access(xcworkspacePath);
        projectOrWorkspaceArg = '-workspace';
        projectOrWorkspacePath = xcworkspacePath;
        console.log(`ℹ️ 检测到 Xcode Workspace: ${xcworkspacePath}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            try {
                await fs.access(xcodeprojPath);
                projectOrWorkspaceArg = '-project';
                projectOrWorkspacePath = xcodeprojPath;
                console.log(`ℹ️ 检测到 Xcode Project: ${xcodeprojPath}`);
            } catch (err) {
                console.error(`❌ 未找到 Xcode Workspace 或 Project 文件。请检查路径: ${iosPlatformDir}/App/App.xcworkspace 或 ${iosPlatformDir}/App/App.xcodeproj`);
                process.exit(1);
            }
        } else {
            throw error;
        }
    }

    const scheme = 'App'; // Capacitor 默认的 iOS 应用 Scheme 名称
    const archivePath = path.join(iosPlatformDir, 'build', `${scheme}.xcarchive`);
    const exportPath = path.join(iosPlatformDir, 'build', 'IPA'); // IPA 导出目录

    const infoPlistPath = path.join(iosPlatformDir, 'App/App.xcodeproj', 'project.pbxproj');
    try {
        await fixXcodeProject(infoPlistPath,scheme, teamId, profileName)
        console.log('✅ project.pbxproj 项目文件更新成功。');
    } catch (error) {
        console.warn(`⚠️ 无法读取或修改 project.pbxproj 文件 (${infoPlistPath})：${error.message}。打包将继续，但 Bundle ID 可能会依赖于 xcodebuild 命令行参数。`);
    }

    // 构建 xcodebuild archive 命令
    // 指定 CODE_SIGN_IDENTITY 为 "Apple Distribution: Your Name (Team ID)" 或者 "iPhone Distribution"
    // 或者直接从 P12 中提取到的通用签名身份
    const archiveArgs = [
        'archive',
        projectOrWorkspaceArg, projectOrWorkspacePath,
        '-scheme', scheme,
        '-configuration', 'Release',
        '-destination', 'generic/platform=iOS',
        '-archivePath', archivePath,
        `CODE_SIGN_STYLE=Manual`, // 强制手动签名
        `DEVELOPMENT_TEAM=${teamId}`,
        `PROVISIONING_PROFILE_SPECIFIER=${profileName}` // 👈 修改或添加这一行
    ];

    // 构建 exportOptionsPlist 文件的内容
    const exportOptionsPlistContent = {
        //distribution  根据您的需求选择 'development', 'ad-hoc', 'app-store'
        method: iosBuildConfig.p12Type === 'distribution' ? 'release-testing' : iosBuildConfig.p12Type === 'development' ? 'development' : 'release-testing',
        signingCertificate: 'Apple Distribution',
        teamID: teamId,
        signingStyle: 'manual',
        stripSwiftSymbols: true,
        uploadBitcode: false,
        uploadSymbols: true, // 是否上传符号表
        provisioningProfiles: {
            [buildConfig.app.appId]: profileName // 描述文件名称
        }
    };

    const exportOptionsPlistPath = path.join(iosPlatformDir, 'build', 'exportOptions.plist');
    await fs.mkdir(path.dirname(exportOptionsPlistPath), {recursive: true});
    await fs.writeFile(exportOptionsPlistPath, plist.build(exportOptionsPlistContent));
    console.log(`✅ 已创建导出选项 plist 文件: ${exportOptionsPlistPath}`);

//    const exportCommand = `
//    xcodebuild
//    -exportArchive
//    -archivePath "${archivePath}"
//    -exportOptionsPlist "${exportOptionsPlistFullPath}"
//    -exportPath "${exportPath}"`;
    const exportArgs = [
        '-exportArchive',
        '-archivePath', archivePath,
        '-exportPath', exportPath,
        '-exportOptionsPlist', exportOptionsPlistPath,
    ];

    let finalIpaPath = '';
    try {
        console.log(`🚀 执行 Xcode Archive 命令: xcodebuild ${archiveArgs.join(' ')}`);
        await execa('xcodebuild', archiveArgs, {
            stdio: 'inherit',
            cwd: iosPlatformDir,
            env: {...process.env, XCODE_DEVELOPMENT_TEAM: teamId, BUILD_NUMBER: buildNumber}, // 传递 Team ID 和 Build Number
        });
        console.log(`✅ Xcode Archive 完成！归档路径: ${archivePath}`);

        console.log(`🚀 执行 Xcode Export IPA 命令: xcodebuild ${exportArgs.join(' ')}`);
        await execa('xcodebuild', exportArgs, {
            stdio: 'inherit',
            cwd: iosPlatformDir,
        });
        console.log(`✅ IPA 导出完成！导出路径: ${exportPath}`);

        // 查找生成的 IPA 文件
        const exportedFiles = await fs.readdir(exportPath);
        const ipaFile = exportedFiles.find(file => file.endsWith('.ipa'));
        if (ipaFile) {
            finalIpaPath = path.join(exportPath, ipaFile);
            console.log(`✅ 生成的 IPA 文件: ${finalIpaPath}`);
        } else {
            throw new Error('未找到导出的 IPA 文件。');
        }

        // 5. 打包成功也将ipa复制到指定目录
        // 按照要求使用 displayName 作为子目录: ./build/{displayName}/{fileName}
        const destArtifactsDir = path.resolve(projectRoot, artifactsDir, displayName);
        await fs.mkdir(destArtifactsDir, {recursive: true});

        const now = new Date();
        const formattedDate = formatDateTime(now, 'YYYYMMDD');
        const formattedTime = formatDateTime(now, 'HHmmss');

        // 替换 iosIpaNameFormat 中的占位符
        const finalIpaName = iosIpaNameFormat
            .replace(/{appName}/g, displayName)
            .replace(/{versionName}/g, versionName)
            .replace(/{buildNumber}/g, buildNumber)
            .replace(/{date}/g, formattedDate)
            .replace(/{time}/g, formattedTime);

        const destIpaPath = path.join(destArtifactsDir, finalIpaName);
        await fs.copyFile(finalIpaPath, destIpaPath);
        console.log(`✅ IPA 已复制到指定目录: ${destIpaPath}`);

    } catch (error) {
        console.error(`❌ iOS 打包失败: ${error.message}`);
        throw error; // 重新抛出错误，由主函数捕获
    } finally {
        // 清理临时钥匙串
        try {
            console.log(`🗑️ 正在删除临时钥匙串: ${keychainPath}`);
            await execa('security', ['delete-keychain', keychainPath], {stdio: 'ignore'});
            console.log('✅ 临时钥匙串已成功删除。');
        } catch (cleanupError) {
            console.error(`❌ 删除临时钥匙串失败 (可能已被删除或权限问题): ${cleanupError.message}`);
        }
    }

}

export {iosBuild};