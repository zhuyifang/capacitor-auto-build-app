import fs from "node:fs";
import config from "../config.js";
import path from "path";

/**
 * 修改或添加 Gradle 文件中 ext { ... } 块内的键值对。
 * 如果键不存在，则添加；如果键已存在，则更新其值。
 *
 * @param {string} key 要添加或修改的键名（例如：'androidxMaterialVersion'）。
 * @param {string} value 要设置的新值（确保是字符串，例如：'1.12.0'）。
 * @returns {boolean} 如果修改成功返回 true，否则返回 false。
 */
async function variablesGradle( key, value) {
    const filePath = path.join(config.ANDROID_DIR, 'variables.gradle');
    // 1. 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        console.error(`❌ 文件不存在: ${filePath}`);
        return false;
    }

    let content = await fs.promises.readFile(filePath, 'utf8');

    // 2. 查找并捕获 ext { ... } 块
    // 正则表达式匹配 'ext {' 后面的所有内容直到最近的 '}'
    const extBlockRegex = /(ext\s*\{\s*)([\s\S]*?)(\s*\})/m;
    const match = content.match(extBlockRegex);

    if (!match) {
        console.error(`❌ 未在文件 ${filePath} 中找到 'ext { ... }' 块。`);
        return false;
    }

    // fullMatch 是整个匹配的字符串（包括 ext { 和 }）
    // prefix 是 'ext {' 及它后面的空白
    // innerContent 是 { } 内部的实际内容
    // suffix 是 } 及它前面的空白
    let [fullMatch, prefix, innerContent, suffix] = match;

    // 3. 检查键是否已存在于 ext 块内部
    // 匹配 key = 'value' 或 key = "value" 或 key = 无引号的值
    // 使用非捕获组来匹配行首或空白字符，以便更好地定位行
    const keyRegex = new RegExp(`(^|\\s+)${key}\\s*=\\s*['"]?([^'"]*)['"]?(\\s*$)`, 'm');
    const keyMatch = innerContent.match(keyRegex);

    if (keyMatch) {
        // --- 修改现有键值的逻辑 ---
        const oldValue = keyMatch[2]; // 捕获旧值
        const newLine = `${key} = '${value}'`; // 统一使用单引号格式
        innerContent = innerContent.replace(keyRegex, `$1${newLine}$3`);
        console.log(`✅ 已在文件 ${filePath} 中更新键 '${key}'：'${oldValue}' -> '${value}'`);
    } else {
        // --- 添加新键值的逻辑 ---
        // 查找插入点：通常在 ext 块内部的最后一个非空行之后，保持缩进
        const lines = innerContent.split('\n');
        let insertIndex = lines.length; // 默认插入到末尾

        // 从后往前找第一个非空行，新行插入到它的下一行
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim() !== '') {
                insertIndex = i + 1;
                break;
            }
        }

        // 假设默认缩进是 4 个空格
        const indentation = '    ';
        lines.splice(insertIndex, 0, `${indentation}${key} = '${value}'`); // 插入新行
        innerContent = lines.join('\n'); // 重新组合内部内容
        console.log(`✅ 已在文件 ${filePath} 中添加新键 '${key}' = '${value}'`);
    }

    // 4. 将修改后的内容写回文件
    const newContent = content.replace(fullMatch, `${prefix}${innerContent}${suffix}`);
    await fs.promises.writeFile(filePath, newContent, 'utf8');

    return true;
}
export { variablesGradle}