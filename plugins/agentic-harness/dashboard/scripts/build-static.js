#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const source = path.join(__dirname, '..', '..', 'ui', 'index.html');
const output = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(source)) throw new Error('Dashboard source UI is missing.');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.copyFileSync(source, output);
console.log('Static dashboard built:', output);
