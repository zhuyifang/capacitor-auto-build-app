import xcode from 'xcode';
import fs from "node:fs";

function modifyXcodeProjectSetting(configString, keyToUpdate, newValue) {
    const escapedKey = keyToUpdate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const regex = new RegExp(`(${escapedKey}\\s*=\\s*)(.*?)(;)`, 'g');

    // Replace all matched lines with the new value
    const updatedString = configString.replace(regex, `$1${newValue}$3`);

    return addXcodeBuildSettings(updatedString);
}

export {modifyXcodeProjectSetting}

function addXcodeBuildSettings(xcodeProjContent) {
    let updatedContent = xcodeProjContent;

    // 定义要插入的键值对和它们的目标配置块的名称
    const settingsToAdd = [
        {
            key: '"CODE_SIGN_IDENTITY[sdk=iphoneos*]"',
            value: '"iPhone Distribution"',
            targetConfigs: ['Debug', 'Release'] // 适用于 Debug 和 Release 配置
        },
        {
            key: '"DEVELOPMENT_TEAM[sdk=iphoneos*]"',
            value: 'PN52VMRM2A',
            targetConfigs: ['Debug', 'Release']
        },
        {
            key: '"PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]"',
            value: '"OK00008030-001E51481AD1802E24"',
            targetConfigs: ['Debug', 'Release']
        }
    ];

    // 遍历要添加的每个设置
    settingsToAdd.forEach(setting => {
        setting.targetConfigs.forEach(configName => {
            // 匹配特定的 buildSettings 块（例如：/* Debug */ = { isa = XCBuildConfiguration; buildSettings = { ... }; name = Debug; }）
            // 注意：这里我们更精确地匹配包含 targetName 的配置块 (504EC3171FED79650016851F /* Debug */ = { ... })
            // 而不是项目级别的配置块 (504EC3141FED79650016851F /* Debug */ = { ... })
            const regex = new RegExp(
                `(\\s*\\/\\* ${configName} \\*\\/\\s*=\\s*{\\s*[^}]*?buildSettings\\s*=\\s*{)([^}]*)(\\s*};\\s*name\\s*=\\s*${configName};\\s*})`,
                's' // 's' flag for dotAll mode, allows . to match newlines
            );

            updatedContent = updatedContent.replace(regex, (match, prefix, currentSettings, suffix) => {
                // 构建要插入的新行
                const newSettingLine = `\n             ${setting.key} = ${setting.value};`;

                // 检查这个设置是否已经存在，如果存在则不重复添加
                if (currentSettings.includes(`${setting.key} = `)) {
                    return match; // 如果已存在，则返回原始匹配，不作修改
                } else {
                    // 在 buildSettings 内部的末尾插入新行
                    // 确保在其他设置行之后，在 closing '}' 之前插入
                    return `${prefix}${currentSettings}${newSettingLine}${suffix}`;
                }
            });
        });
    });

    return updatedContent;
}



/**
 * 修复 Xcode 项目文件
 * @param xcodeprojPath
 * @param targetName   // 你的应用目标名称 (通常是 'App')
 * @param teamID   // 你的 Apple Developer Team ID
 * @param profileUUID  // <-- !!! 替换为你的 描述文件 UUID !!!
 * @returns {Promise<void>}
 */

export async function fixXcodeProject(xcodeprojPath,targetName,teamID,profileUUID) {

    try {
        console.log(`🚀 正在加载 Xcode 项目文件: ${xcodeprojPath}`);
        const myProj = xcode.project(xcodeprojPath);

        // 解析项目文件
        await new Promise((resolve, reject) => {
            myProj.parse((err) => {
                if (err) {
                    console.error('❌ 解析 Xcode 项目文件失败:', err);
                    return reject(err);
                }
                resolve();
            });
        });

        console.log('✅ Xcode 项目文件加载成功。');

        // =========================================================================
        // 1. 获取目标 (Native Target) 的 UUID 和 Build Configuration List UUID
        // =========================================================================
        const nativeTargets = myProj.pbxNativeTargetSection();
        let appTargetUuid = null;
        let buildConfigurationListUuid = null;

        for (const uuid in nativeTargets) {
            if (uuid.endsWith('_comment')) continue; // 忽略注释
            if (nativeTargets[uuid].name === targetName) {
                appTargetUuid = uuid;
                buildConfigurationListUuid = nativeTargets[uuid].buildConfigurationList;
                break;
            }
        }

        if (!appTargetUuid || !buildConfigurationListUuid) {
            throw new Error(`未找到名为 "${targetName}" 的应用目标或其构建配置列表。`);
        }
        console.log(`找到目标 "${targetName}" (UUID: ${appTargetUuid})，其配置列表 UUID: ${buildConfigurationListUuid}`);

        // =========================================================================
        // 2. 寻找 Begin PBXProject section 部分，设置 ProvisioningStyle = Manual;
        // =========================================================================
        // 增加获取 rootObjectUUID 的健壮性
        const projectObjectUUID = myProj.rootObject || (myProj.hash && myProj.hash.project && myProj.hash.project.rootObject);

        if (!projectObjectUUID) {
            throw new Error('无法在 Xcode 项目中找到根项目对象 (rootObject UUID)。这可能是因为 .pbxproj 文件损坏或格式异常。');
        }

        const projectObject = myProj.pbxProjectSection()[projectObjectUUID];
        if (!projectObject || !projectObject.attributes) {
            // 这通常不应该发生，如果 projectObjectUUID 存在但 projectObject 不存在或没有 attributes
            throw new Error(`未找到 UUID 为 ${projectObjectUUID} 的项目对象或其属性。请检查 .pbxproj 文件。`);
        }

        console.log(`✅ 成功获取到项目根对象 (UUID: ${projectObjectUUID})。`);

        // 修改 LastSwiftUpdateCheck 为 "0920" (保留前导零，即使你本次未提及，但为了完整性保留)
        projectObject.attributes.LastSwiftUpdateCheck = '0920';
        console.log(`✅ 项目属性 'LastSwiftUpdateCheck' 已设置为 '0920'。`);

        projectObject.attributes.LastUpgradeCheck = '0920';
        console.log(`✅ 项目属性 'LastUpgradeCheck' 已设置为 '0920'。`);

        // 设置 ProvisioningStyle = Manual; (位于 TargetAttributes 下)
        if (!projectObject.attributes.TargetAttributes) {
            projectObject.attributes.TargetAttributes = {};
        }
        if (!projectObject.attributes.TargetAttributes[appTargetUuid]) {
            projectObject.attributes.TargetAttributes[appTargetUuid] = {};
        }
        projectObject.attributes.TargetAttributes[appTargetUuid].ProvisioningStyle = 'Manual';
        console.log(`✅ Project.TargetAttributes 中 'ProvisioningStyle' 已设置为 'Manual'。`);


        // =========================================================================
        // 3. 获取目标级别的所有 Build Configuration (Debug 和 Release)
        // =========================================================================
        const configurationList = myProj.pbxXCConfigurationList()[buildConfigurationListUuid];
        if (!configurationList) {
            throw new Error(`未找到 UUID 为 ${buildConfigurationListUuid} 的构建配置列表。`);
        }

        const buildConfigs = configurationList.buildConfigurations.map(config => {
            const configUuid = config.value;
            const configObj = myProj.pbxXCBuildConfigurationSection()[configUuid];
            if (!configObj) {
                throw new Error(`未找到 UUID 为 ${configUuid} 的构建配置对象。`);
            }
            return configObj;
        });

        if (buildConfigs.length === 0) {
            throw new Error(`目标 "${targetName}" 没有有效的构建配置。`);
        }
        console.log(`找到目标 "${targetName}" 的 ${buildConfigs.length} 个构建配置。`);

        // =========================================================================
        // 4. 遍历并直接修改每个 Target 级别的 Build Configuration 中的签名属性
        // =========================================================================
        for (const config of buildConfigs) {
            const configName = config.name; // 'Debug' 或 'Release'
            const buildSettings = config.buildSettings; // 直接操作 buildSettings 对象
            console.log(`\n⚙️ 正在为目标 "${targetName}" 的配置 "${configName}" 设置签名属性...`);

            if (configName === 'Debug') {
                console.log(`   - 针对 Debug 配置 (UUID: ${config.uuid})`);
                // 1 修改为 CODE_SIGN_STYLE = Manual;
                buildSettings.CODE_SIGN_STYLE = 'Manual';
                console.log(`     - 'CODE_SIGN_STYLE' 已设置为 'Manual'。`);

                // 2 添加/设置 Debug 配置的具体属性
                buildSettings['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'] = '"iPhone Distribution"'; // 严格按你的需求
                // 默认的非SDK限定的 CODE_SIGN_IDENTITY，通常是 "iPhone Developer"
                // 如果你的目标文件里这个值是空字符串或没有，需要进一步确认
                if (!buildSettings.CODE_SIGN_IDENTITY) { // 仅在缺失时添加
                    buildSettings.CODE_SIGN_IDENTITY = '"iPhone Developer"';
                }


                buildSettings.DEVELOPMENT_TEAM = '""';
                buildSettings['"DEVELOPMENT_TEAM[sdk=iphoneos*]"'] = teamID;
                buildSettings.PROVISIONING_PROFILE_SPECIFIER = '""';
                buildSettings['"PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]"'] = profileUUID; // 使用 Debug 特定的 UUID

                console.log(`     - '"CODE_SIGN_IDENTITY[sdk=iphoneos*]"' 已设置为 '"iPhone Distribution"'。`);
                console.log(`     - 'DEVELOPMENT_TEAM' 已设置为 '' 和 '${teamID}'。`);
                console.log(`     - 'PROVISIONING_PROFILE_SPECIFIER' 已设置为 '' 和 '${profileUUID}'。`);

            } else if (configName === 'Release') {
                console.log(`   - 针对 Release 配置 (UUID: ${config.uuid})`);
                // 1 添加/设置 Release 配置的具体属性
                buildSettings['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'] = '"iPhone Distribution"'; // 严格按你的需求
                // 默认的非SDK限定的 CODE_SIGN_IDENTITY
                if (!buildSettings.CODE_SIGN_IDENTITY) { // 仅在缺失时添加
                    buildSettings.CODE_SIGN_IDENTITY = '"iPhone Distribution"';
                }

                buildSettings.DEVELOPMENT_TEAM = '""';
                buildSettings['"DEVELOPMENT_TEAM[sdk=iphoneos*]"'] = teamID;
                buildSettings.PROVISIONING_PROFILE_SPECIFIER = '""';
                buildSettings['"PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]"'] = profileUUID; // 使用 Release 特定的 UUID

                console.log(`     - 'CODE_SIGN_IDENTITY[sdk=iphoneos*]' 已设置为 '"iPhone Distribution"'。`);
                console.log(`     - 'DEVELOPMENT_TEAM' 已设置为 '' 和 '${teamID}'。`);
                console.log(`     - 'PROVISIONING_PROFILE_SPECIFIER' 已设置为 '' 和 '${profileUUID}'。`);

                // 2 修改为 CODE_SIGN_STYLE = Manual;
                buildSettings.CODE_SIGN_STYLE = 'Manual';
                console.log(`     - 'CODE_SIGN_STYLE' 已设置为 'Manual'。`);

            } else {
                console.warn(`   - 注意: 未为配置 "${configName}" 指定签名属性，跳过设置。`);
            }
        }

        // =========================================================================
        // 保存修改后的项目文件
        // =========================================================================
        const pbxprojContent = myProj.writeSync();
        fs.writeFileSync(xcodeprojPath, pbxprojContent, 'utf8');

        console.log(`\n🎉 Xcode 项目文件配置已更新成功!`);
    } catch (error) {
        console.error(`\n🚨 配置 Xcode 签名失败:`, error.message);
        process.exit(1);
    }

}

