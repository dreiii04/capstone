function hasBytes(buffer, expected) {
  if (!Buffer.isBuffer(buffer) || buffer.length < expected.length) return false;
  return expected.every((value, index) => buffer[index] === value);
}

function isSupportedImage(buffer) {
  return hasBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
    hasBytes(buffer, [0xff, 0xd8, 0xff]);
}

module.exports = { isSupportedImage };
