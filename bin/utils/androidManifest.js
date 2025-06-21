import { promises as fs } from 'fs';
import path from 'path';
import { Builder, parseStringPromise } from 'xml2js';

// 模块内部变量，用于存储 projectRoot
let _projectRoot = '';

/**
 * 助手函数：确保节点始终为数组
 * @param {any} node 可能是对象或数组
 * @returns {Array} 总是返回数组
 */
function ensureArray(node) {
    if (node === undefined || node === null) {
        return [];
    }
    return Array.isArray(node) ? node : [node];
}

/**
 * 基础方法：读取、修改并写回 AndroidManifest.xml。
 * 这是一个内部函数，不对外暴露，因为它依赖于 _projectRoot。
 *
 * @param {function(object): void} modifier 一个回调函数，接收解析后的 Manifest 对象，
 * 您可以在其中直接修改该对象。
 * @returns {Promise<boolean>} 如果修改成功返回 true，否则返回 false。
 */
async function modifyAndroidManifestBase(modifier) {
    if (!_projectRoot) {
        console.error('❌ 错误: projectRoot 未设置。请先调用 initAndroidManifestUtils(yourProjectRoot) 方法。');
        return false;
    }
    const manifestPath = path.resolve(_projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

    try {
        await fs.access(manifestPath, fs.constants.F_OK);
    } catch (error) {
        console.error(`❌ AndroidManifest.xml 文件不存在: ${manifestPath}`);
        return false;
    }

    try {
        const xmlContent = await fs.readFile(manifestPath, 'utf8');
        const parsedManifest = await parseStringPromise(xmlContent, { explicitArray: false, mergeAttrs: true });

        modifier(parsedManifest);

        const builder = new Builder({ headless: true, renderOpts: { pretty: true, indent: '    ' } });
        const updatedXmlContent = builder.buildObject(parsedManifest);

        await fs.writeFile(manifestPath, updatedXmlContent, 'utf8');
        console.log(`✅ AndroidManifest.xml 已成功修改: ${manifestPath}`);
        return true;
    } catch (error) {
        console.error(`❌ 无法修改 AndroidManifest.xml 文件 ${manifestPath}:`, error.message);
        return false;
    }
}

// --- 封装后的具体操作方法 ---

/**
 * 添加一个 uses-permission 权限到 AndroidManifest.xml。
 *
 * @param {string} permissionName 要添加的权限名称，例如 'android.permission.RECORD_AUDIO'。
 * @returns {Promise<boolean>}
 */
async function addPermission(permissionName) {
    return modifyAndroidManifestBase((manifest) => {
        if (!manifest.manifest['uses-permission']) {
            manifest.manifest['uses-permission'] = [];
        }
        const permissions = ensureArray(manifest.manifest['uses-permission']);

        const hasPermission = permissions.some(p => p['android:name'] === permissionName);

        if (!hasPermission) {
            permissions.push({ '$': { 'android:name': permissionName } });
            manifest.manifest['uses-permission'] = permissions;
            console.log(`   -> 添加了权限: ${permissionName}`);
        } else {
            console.log(`   -> 权限已存在，跳过: ${permissionName}`);
        }
    });
}

/**
 * 更新 MainActivity（或指定 Activity）的某个属性。
 *
 * @param {string} attributeName 属性名，例如 'android:label'。
 * @param {string} newValue 新的值。
 * @param {string} [activityName='.MainActivity'] 要修改的 Activity 名称。
 * @returns {Promise<boolean>}
 */
async function updateMainActivityAttribute(attributeName, newValue, activityName = '.MainActivity') {
    return modifyAndroidManifestBase((manifest) => {
        const application = manifest.manifest.application;
        if (!application || !application.activity) {
            console.log("   -> 未找到 application 或 activity 标签。");
            return;
        }

        const activities = ensureArray(application.activity);
        const targetActivity = activities.find(a => a['android:name'] === activityName);

        if (targetActivity) {
            const oldValue = targetActivity[attributeName];
            if (oldValue !== newValue) {
                targetActivity[attributeName] = newValue;
                console.log(`   -> 更新了 ${activityName} 的 ${attributeName}：'${oldLabel}' -> '${newLabel}'`); // oldLabel/newLabel 变量名错误，应该是 oldValue/newValue
            } else {
                console.log(`   -> ${activityName} 的 ${attributeName} 已是最新：'${newValue}'`);
            }
        } else {
            console.log(`   -> 未找到 Activity: ${activityName}。`);
        }
    });
}

/**
 * 在 MainActivity 的启动器 intent-filter 或指定 intent-filter 中添加一个 category。
 *
 * @param {string} categoryName 要添加的 category 名称，例如 'android.intent.category.DEFAULT_BROWSABLE'。
 * @param {object} [filterCriteria] 可选：用于查找特定 intent-filter 的条件。
 * @param {string} [activityName='.MainActivity'] 要修改的 Activity 名称。
 * @returns {Promise<boolean>}
 */
async function addCategoryToIntentFilter(categoryName, filterCriteria, activityName = '.MainActivity') {
    return modifyAndroidManifestBase((manifest) => {
        const application = manifest.manifest.application;
        if (!application || !application.activity) {
            console.log("   -> 未找到 application 或 activity 标签。");
            return;
        }

        const activities = ensureArray(application.activity);
        const targetActivity = activities.find(a => a['android:name'] === activityName);

        if (!targetActivity) {
            console.log(`   -> 未找到 Activity: ${activityName}。`);
            return;
        }

        if (!targetActivity['intent-filter']) {
            console.log("   -> 目标 Activity 中未找到任何 intent-filter。");
            return;
        }
        const intentFilters = ensureArray(targetActivity['intent-filter']);

        let targetFilter;
        if (filterCriteria) {
            targetFilter = intentFilters.find(filter => {
                let matches = true;
                if (filterCriteria.action) {
                    const filterActions = ensureArray(filter.action);
                    matches = matches && filterActions.some(a => a['android:name'] === filterCriteria.action);
                }
                if (filterCriteria.category) {
                    const filterCategories = ensureArray(filter.category);
                    matches = matches && filterCategories.some(c => c['android:name'] === filterCriteria.category);
                }
                return matches;
            });
        } else {
            targetFilter = intentFilters.find(filter =>
                ensureArray(filter.action).some(a => a['android:name'] === 'android.intent.action.MAIN') &&
                ensureArray(filter.category).some(c => c['android:name'] === 'android.intent.category.LAUNCHER')
            );
        }

        if (targetFilter) {
            if (!targetFilter.category) {
                targetFilter.category = [];
            }
            const categories = ensureArray(targetFilter.category);

            const hasCategory = categories.some(c => c['android:name'] === categoryName);

            if (!hasCategory) {
                categories.push({ '$': { 'android:name': categoryName } });
                targetFilter.category = categories;
                console.log(`   -> 在 intent-filter 中添加了 category: ${categoryName}`);
            } else {
                console.log(`   -> intent-filter 中已存在 category: ${categoryName}，跳过`);
            }
        } else {
            console.log("   -> 未找到符合条件的 intent-filter。");
        }
    });
}

/**
 * 在 MainActivity 的启动器 intent-filter 或指定 intent-filter 中添加一个 data 标签。
 *
 * @param {object} dataAttributes 要添加的 data 标签属性，例如 { 'android:scheme': '@string/custom_url_scheme' }。
 * @param {object} [filterCriteria] 可选：用于查找特定 intent-filter 的条件。
 * @param {string} [activityName='.MainActivity'] 要修改的 Activity 名称。
 * @returns {Promise<boolean>}
 */
async function addDataToIntentFilter(dataAttributes, filterCriteria, activityName = '.MainActivity') {
    return modifyAndroidManifestBase((manifest) => {
        const application = manifest.manifest.application;
        if (!application || !application.activity) {
            console.log("   -> 未找到 application 或 activity 标签。");
            return;
        }

        const activities = ensureArray(application.activity);
        const targetActivity = activities.find(a => a['android:name'] === activityName);

        if (!targetActivity) {
            console.log(`   -> 未找到 Activity: ${activityName}。`);
            return;
        }

        if (!targetActivity['intent-filter']) {
            console.log("   -> 目标 Activity 中未找到任何 intent-filter。");
            return;
        }
        const intentFilters = ensureArray(targetActivity['intent-filter']);

        let targetFilter;
        if (filterCriteria) {
            targetFilter = intentFilters.find(filter => {
                let matches = true;
                if (filterCriteria.action) {
                    const filterActions = ensureArray(filter.action);
                    matches = matches && filterActions.some(a => a['android:name'] === filterCriteria.action);
                }
                if (filterCriteria.category) {
                    const filterCategories = ensureArray(filter.category);
                    matches = matches && filterCategories.some(c => c['android:name'] === filterCriteria.category);
                }
                return matches;
            });
        } else {
            targetFilter = intentFilters.find(filter =>
                ensureArray(filter.action).some(a => a['android:name'] === 'android.intent.action.MAIN') &&
                ensureArray(filter.category).some(c => c['android:name'] === 'android.intent.category.LAUNCHER')
            );
        }

        if (targetFilter) {
            if (!targetFilter.data) {
                targetFilter.data = [];
            }
            const datas = ensureArray(targetFilter.data);

            const hasData = datas.some(d => {
                let allAttrsMatch = true;
                for (const attrKey in dataAttributes) {
                    if (d[attrKey] !== dataAttributes[attrKey]) {
                        allAttrsMatch = false;
                        break;
                    }
                }
                return allAttrsMatch;
            });

            if (!hasData) {
                datas.push({ '$': dataAttributes });
                targetFilter.data = datas;
                console.log(`   -> 在 intent-filter 中添加了 data 标签: ${JSON.stringify(dataAttributes)}`);
            } else {
                console.log(`   -> intent-filter 中已存在 data 标签: ${JSON.stringify(dataAttributes)}，跳过`);
            }
        } else {
            console.log("   -> 未找到符合条件的 intent-filter。");
        }
    });
}

/**
 * 添加一个 uses-feature 标签到 AndroidManifest.xml。
 * 如果 features 已存在且属性完全匹配，则跳过。
 *
 * @param {string} featureName 功能名称，例如 'android.hardware.camera'。
 * @param {boolean} required 是否必需，例如 false。
 * @returns {Promise<boolean>}
 */
async function addUsesFeature(featureName, required) {
    return modifyAndroidManifestBase((manifest) => {
        if (!manifest.manifest['uses-feature']) {
            manifest.manifest['uses-feature'] = [];
        }
        const features = ensureArray(manifest.manifest['uses-feature']);

        // 检查是否已存在具有相同 name 和 required 属性的 feature
        const hasFeature = features.some(f =>
            f['android:name'] === featureName &&
            (f['android:required'] === String(required) || f['android:required'] === required) // 比较时考虑布尔值到字符串的转换
        );

        if (!hasFeature) {
            features.push({
                '$': {
                    'android:name': featureName,
                    'android:required': String(required) // 确保这里转换为字符串
                }
            });
            manifest.manifest['uses-feature'] = features;
            console.log(`   -> 添加了 uses-feature: name='${featureName}', required='${required}'`);
        } else {
            console.log(`   -> uses-feature 已存在，跳过: name='${featureName}', required='${required}'`);
        }
    });
}
/**
 * 初始化 AndroidManifest 工具函数。
 * 必须在调用任何其他修改函数之前调用。
 *
 * @param {string} projectRoot Your Capacitor or Android project's root directory.
 */
export function initAndroidManifestUtils(projectRoot) {
    _projectRoot = projectRoot;
    console.log(`✅ AndroidManifest 工具已初始化，项目根目录设置为: ${_projectRoot}`);
    return {
        addPermission,
        updateMainActivityAttribute,
        addCategoryToIntentFilter,
        addDataToIntentFilter,
        addUsesFeature
    };
}
