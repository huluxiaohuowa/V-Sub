const fs = require('fs');
const path = require('path');
const convert = require('opencc-js').Converter({ from: 'cn', to: 'twp' });
const source = 'renderer/public/locales/zh';
const target = 'renderer/public/locales/zh-TW';
fs.mkdirSync(target, { recursive: true });
const walk = value => typeof value === 'string' ? convert(value) : Array.isArray(value) ? value.map(walk) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, val]) => [key, walk(val)])) : value;
for (const file of fs.readdirSync(source)) if (file.endsWith('.json')) fs.writeFileSync(path.join(target, file), JSON.stringify(walk(JSON.parse(fs.readFileSync(path.join(source, file), 'utf8'))), null, 2));
