// 七猫小说 API 客户端
// 基于 swiftcat-downloader-flutter 的实现

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { pluginState } from '../core/state';

// 七猫小说 API 配置
const SIGN_KEY = 'd3dGiJc651gSQ8w1';
const AES_KEY_HEX = '32343263636238323330643730396531';
const BASE_URL_BC = 'https://api-bc.wtzw.com';
const BASE_URL_KS = 'https://api-ks.wtzw.com';

const VERSION_LIST = [
  '73720', '73700', '73620', '73600', '73500', '73420', '73400',
  '73328', '73325', '73320', '73300', '73220', '73200', '73100',
  '73000', '72900', '72820', '72800', '70720', '62010', '62112',
];

// 数据接口
export interface QimaoBook 