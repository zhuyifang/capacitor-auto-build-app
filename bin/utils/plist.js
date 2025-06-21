import fs from "node:fs/promises";
import path from "node:path";
import plist from "plist";

/**
 * 添加或修改 iOS 应用的 Info.plist 文件中的键值对。
 * 如果键不存在，则添加；如果键已存在，则更新其值。
 *
 * @param {string} projectRoot Your Capacitor project's root directory (e.g., '/Users/youruser/Projects/YourCapacitorApp').
 * @param {string} key The key to add or modify (e.g., 'NSMicrophoneUsageDescription').
 * @param {string} value The value to set (e.g., 'We need your microphone access to record audio.').
 * @returns {Promise<boolean>} Resolves to true if successful, false otherwise.
 */
async function updateInfoPlistValue(projectRoot, key, value) {
    const infoPlistPath = path.resolve(projectRoot, 'ios', 'App', 'App', 'Info.plist');

    // 1. 检查文件是否存在
    try {
        await fs.access(infoPlistPath, fs.constants.F_OK); // 检查文件是否存在
    } catch (error) {
        console.error(`❌ Info.plist 文件不存在: ${infoPlistPath}`);
        return false;
    }

    let parsedPlist;
    try {
        // 2. 读取并解析 Info.plist 文件内容
        const plistContent = await fs.readFile(infoPlistPath, 'utf8');
        parsedPlist = plist.parse(plistContent);
    } catch (parseError) {
        console.error(`❌ 无法解析 Info.plist 文件 ${infoPlistPath}:`, parseError.message);
        return false;
    }

    // 3. 修改或添加键值对
    const oldValue = parsedPlist[key];
    parsedPlist[key] = value; // 直接通过对象属性赋值，plist 库会处理类型

    if (oldValue !== undefined) {
        if (oldValue !== value) {
            console.log(`✅ 已在 Info.plist 中更新键 '${key}'：'${oldValue}' -> '${value}'`);
        } else {
            console.log(`ℹ️ Info.plist 中的键 '${key}' 的值已是最新：'${value}'`);
        }
    } else {
        console.log(`✅ 已在 Info.plist 中添加新键 '${key}' = '${value}'`);
    }

    // 4. 将修改后的 JavaScript 对象序列化回 plist 格式
    const updatedPlistContent = plist.build(parsedPlist);

    // 5. 写回 Info.plist 文件
    try {
        await fs.writeFile(infoPlistPath, updatedPlistContent, 'utf8');
        return true;
    } catch (writeError) {
        console.error(`❌ 无法写入 Info.plist 文件 ${infoPlistPath}:`, writeError.message);
        return false;
    }
}
export default {updateInfoPlistValue}