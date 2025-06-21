// bin/config.js
import path from "node:path";
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
    PROJECT_ROOT: path.resolve(__dirname, '../'),
    ANDROID_DIR: path.resolve(__dirname, '../android'),
    IOS_DIR: path.resolve(__dirname, '../ios'),
    BASE_PLUGIN: [
        '@capacitor/app',
        '@ionic/pwa-elements',
        '@capacitor/app-launcher',
        //'@capacitor/background-runner', //TODO 暂时不予支持 因为需求场景比较少
        '@capacitor/browser',
        '@capacitor/camera',
        '@capacitor/clipboard',
        '@capacitor/filesystem',
        '@capacitor/haptics',
        '@capacitor/keyboard',
        '@capacitor/network',
        '@capacitor/share',
        '@capacitor/splash-screen',
        '@capacitor/status-bar',
        '@capacitor/device',
        '@capacitor/file-transfer',
    ]
};

export default config;