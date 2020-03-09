export function toHexString(byteArray) {
  return Array.from(byteArray, byte => {
    return ('0' + (byte & 0xff).toString(16)).slice(-2);
  }).join('');
}
