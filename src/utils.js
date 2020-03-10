export function toHexString(byteArray) {
  return Array.from(byteArray, byte => {
    return ('0' + (byte & 0xff).toString(16)).slice(-2);
  }).join('');
}

export function fromHexString(str) {
  return Uint8Array.from(Buffer.from(str, 'hex'));
}

export function toBytesArray(str) {
  return [...Buffer.from(str)];
}
