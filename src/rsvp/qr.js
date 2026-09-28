export async function createQrPattern(token) {
  const { default: QRCode } = await import('qrcode');
  const qrCode = QRCode.create(token, { errorCorrectionLevel: 'M' });
  const { size } = qrCode.modules;
  const darkModules = [];

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (qrCode.modules.get(row, column)) darkModules.push([row, column]);
    }
  }

  if (!darkModules.length) {
    throw new Error('Le code QR ne contient aucun module sombre.');
  }

  return { size, darkModules };
}

export async function createQrPng(token) {
  const { default: QRCode } = await import('qrcode');
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, token, {
    width: 220,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0d1838',
      light: '#ffffff',
    },
  });

  return canvas.toDataURL('image/png');
}
