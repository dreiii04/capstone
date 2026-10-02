function hasBytes(buffer, expected) {
  if (!Buffer.isBuffer(buffer) || buffer.length < expected.length) return false;
  return expected.every((value, index) => buffer[index] === value);
}

function isSupportedImage(buffer) {
  if (hasBytes(buffer, [0xff, 0xd8, 0xff])) {
    return buffer.length > 16 && buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]));
  }
  if (!hasBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
      buffer.length < 45 || buffer.readUInt32BE(8) !== 13 ||
      buffer.toString('ascii', 12, 16) !== 'IHDR' ||
      !buffer.readUInt32BE(16) || !buffer.readUInt32BE(20)) return false;
  let offset = 8;
  let hasImageData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) return false;
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') hasImageData = true;
    if (type === 'IEND') return length === 0 && hasImageData && end === buffer.length;
    offset = end;
  }
  return false;
}

module.exports = { isSupportedImage };
