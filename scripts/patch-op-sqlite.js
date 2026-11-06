const fs = require('fs');
const path = require('path');

const typesHeader = path.join(
  __dirname,
  '..',
  'node_modules',
  '@op-engineering',
  'op-sqlite',
  'cpp',
  'types.h'
);

if (fs.existsSync(typesHeader)) {
  let content = fs.readFileSync(typesHeader, 'utf8');
  if (!content.includes('#include <vector>')) {
    content = content.replace(
      '#include <variant>',
      '#include <variant>\n#include <vector>'
    );
    fs.writeFileSync(typesHeader, content, 'utf8');
    console.log('[postinstall] Patched @op-engineering/op-sqlite with missing #include <vector>');
  }
}

const visionPromise = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-vision-camera',
  'ios',
  'React',
  'Utils',
  'Promise.swift'
);

if (fs.existsSync(visionPromise)) {
  let content = fs.readFileSync(visionPromise, 'utf8');
  if (!content.includes('guard !didResolve else { return }')) {
    content = content.replace(
      'func reject(error: CameraError, cause: NSError?) {',
      'func reject(error: CameraError, cause: NSError?) {\n    guard !didResolve else { return }'
    );
    content = content.replace(
      'func resolve(_ value: Any?) {',
      'func resolve(_ value: Any?) {\n    guard !didResolve else { return }'
    );
    fs.writeFileSync(visionPromise, content, 'utf8');
    console.log('[postinstall] Patched react-native-vision-camera Promise.swift with single invocation guard');
  }
}
