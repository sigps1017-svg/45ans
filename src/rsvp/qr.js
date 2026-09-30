export async function createQrPattern(token) {
  const { default: QRCode } = await import('qrcode');
  const qrCode = QRCode.create(token, { errorCorrectionLevel: 'H' });
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

function drawGem(context, centerX, centerY, width) {
  const height = width * 0.82;
  const top = centerY - height * 0.38;
  const girdle = centerY - height * 0.12;
  const bottom = centerY + height * 0.62;
  const tableWidth = width * 0.28;
  const gradient = context.createLinearGradient(
    centerX - width / 2,
    top,
    centerX + width / 2,
    bottom,
  );
  gradient.addColorStop(0, '#8fb4ff');
  gradient.addColorStop(0.45, '#2451e0');
  gradient.addColorStop(1, '#0a1f6a');
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(centerX - tableWidth, top);
  context.lineTo(centerX + tableWidth, top);
  context.lineTo(centerX + width / 2, girdle);
  context.lineTo(centerX, bottom);
  context.lineTo(centerX - width / 2, girdle);
  context.closePath();
  context.fill();
  context.strokeStyle = 'rgba(220,232,255,.85)';
  context.lineWidth = Math.max(1, width * 0.018);
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(centerX - width / 2, girdle);
  context.lineTo(centerX + width / 2, girdle);
  context.moveTo(centerX - tableWidth, top);
  context.lineTo(centerX - tableWidth * 0.45, girdle);
  context.lineTo(centerX, top);
  context.lineTo(centerX + tableWidth * 0.45, girdle);
  context.lineTo(centerX + tableWidth, top);
  context.moveTo(centerX - tableWidth * 0.45, girdle);
  context.lineTo(centerX, bottom);
  context.lineTo(centerX + tableWidth * 0.45, girdle);
  context.stroke();
  context.fillStyle = 'rgba(255,255,255,.55)';
  context.beginPath();
  context.moveTo(centerX - tableWidth * 0.7, top + height * 0.03);
  context.lineTo(centerX - tableWidth * 0.2, top + height * 0.03);
  context.lineTo(centerX - tableWidth * 0.55, girdle - height * 0.03);
  context.closePath();
  context.fill();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export async function createTicketPng(token, response, event) {
  const { default: QRCode } = await import('qrcode');
  const qrCode = QRCode.create(token, { errorCorrectionLevel: 'H' });
  const { size } = qrCode.modules;
  const width = 1080;
  const height = 1760;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de dessiner la carte d’entrée.');

  const serif = 'Georgia, "Times New Roman", serif';
  const sans = '"Segoe UI", system-ui, sans-serif';
  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, '#13224f');
  background.addColorStop(0.5, '#0b1535');
  background.addColorStop(1, '#060b1f');
  context.fillStyle = background;
  roundRect(context, 0, 0, width, height, 56);
  context.fill();

  const glow = context.createRadialGradient(width / 2, 190, 0, width / 2, 190, 420);
  glow.addColorStop(0, 'rgba(80,120,255,.35)');
  glow.addColorStop(1, 'rgba(80,120,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, 700);

  const gold = context.createLinearGradient(0, 0, width, height);
  gold.addColorStop(0, '#f0d9a6');
  gold.addColorStop(0.5, '#b8924e');
  gold.addColorStop(1, '#f0d9a6');
  context.strokeStyle = gold;
  context.lineWidth = 4;
  roundRect(context, 34, 34, width - 68, height - 68, 40);
  context.stroke();
  context.lineWidth = 1.5;
  context.globalAlpha = 0.6;
  roundRect(context, 50, 50, width - 100, height - 100, 30);
  context.stroke();
  context.globalAlpha = 1;

  drawGem(context, width / 2, 175, 120);
  context.textAlign = 'center';
  context.fillStyle = '#d8b87a';
  context.font = `italic 400 54px ${serif}`;
  context.fillText('Noces de saphir', width / 2, 320);
  context.fillStyle = '#ffffff';
  context.font = `300 104px ${serif}`;
  context.fillText('45 ans d’amour', width / 2, 425);
  context.fillStyle = '#bcd3ff';
  context.font = `400 34px ${sans}`;
  context.fillText(event.hosts.join(' & '), width / 2, 485);

  const qrY = 540;
  const qrSize = 640;
  const qrX = (width - qrSize) / 2;
  roundRect(context, qrX, qrY, qrSize, qrSize, 36);
  context.fillStyle = '#ffffff';
  context.fill();

  const quietZone = 48;
  const moduleSize = (qrSize - quietZone * 2) / size;
  context.fillStyle = '#0d1838';
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (!qrCode.modules.get(row, column)) continue;
      const left = qrX + quietZone + column * moduleSize;
      const top = qrY + quietZone + row * moduleSize;
      context.fillRect(
        Math.floor(left),
        Math.floor(top),
        Math.ceil(left + moduleSize) - Math.floor(left),
        Math.ceil(top + moduleSize) - Math.floor(top),
      );
    }
  }

  const logoSize = 128;
  const logoX = width / 2 - logoSize / 2;
  const logoY = qrY + qrSize / 2 - logoSize / 2;
  context.fillStyle = '#ffffff';
  roundRect(context, logoX, logoY, logoSize, logoSize, 22);
  context.fill();
  context.strokeStyle = '#d8b87a';
  context.lineWidth = 4;
  roundRect(context, logoX + 8, logoY + 8, logoSize - 16, logoSize - 16, 16);
  context.stroke();
  drawGem(context, width / 2, qrY + qrSize / 2 - 6, logoSize * 0.58);

  context.fillStyle = '#bcd3ff';
  context.font = `italic 400 34px ${serif}`;
  context.fillText(token, width / 2, qrY + qrSize + 56);
  context.fillStyle = '#ffffff';
  context.font = `400 64px ${serif}`;
  context.fillText(response.name, width / 2, qrY + qrSize + 150, width - 160);
  const guestCount = response.guests.length;
  context.fillStyle = '#93a0c4';
  context.font = `400 32px ${sans}`;
  context.fillText(
    `${guestCount} ${guestCount > 1 ? 'personnes' : 'personne'}`,
    width / 2,
    qrY + qrSize + 200,
  );
  context.strokeStyle = 'rgba(216,184,122,.55)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(width / 2 - 200, qrY + qrSize + 245);
  context.lineTo(width / 2 + 200, qrY + qrSize + 245);
  context.stroke();
  context.fillStyle = '#eef1fb';
  context.font = `400 38px ${sans}`;
  context.fillText(event.dateLabel, width / 2, qrY + qrSize + 305);
  context.fillStyle = '#93a0c4';
  context.font = `400 30px ${sans}`;
  context.fillText(
    `Cocktail ${event.cocktailTime} · Souper ${event.dinnerTime}`,
    width / 2,
    qrY + qrSize + 355,
  );
  context.fillStyle = '#93a0c4';
  context.font = `400 28px ${sans}`;
  context.fillText(
    `${event.venue} · ${event.address}`,
    width / 2,
    qrY + qrSize + 400,
    width - 160,
  );
  context.fillStyle = '#d8b87a';
  context.font = `italic 400 40px ${serif}`;
  context.fillText(
    'Carte d’entrée à présenter à l’accueil',
    width / 2,
    height - 90,
  );

  return canvas.toDataURL('image/png');
}
