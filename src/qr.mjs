let qrcode = null;
try {
  qrcode = (await import("qrcode-generator")).default;
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

export function createQrSvg(value) {
  if (!qrcode) return null;
  const qr = qrcode(0, "M");
  qr.addData(value, "Byte");
  qr.make();
  return qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
}
