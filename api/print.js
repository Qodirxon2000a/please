
const fs = require('fs');
const PDFDocument = require('pdfkit');
const printer = require('pdf-to-printer');

const CHECK_NUMBER_FILE = 'check_number.txt';
const RESET_TIME_FILE = 'last_reset_time.txt';

const getCheckNumber = () => {
  if (!fs.existsSync(CHECK_NUMBER_FILE)) {
    fs.writeFileSync(CHECK_NUMBER_FILE, '1');
  }
  return parseInt(fs.readFileSync(CHECK_NUMBER_FILE, 'utf8'), 10);
};

const incrementCheckNumber = () => {
  const currentNumber = getCheckNumber();
  const nextNumber = currentNumber + 1;
  fs.writeFileSync(CHECK_NUMBER_FILE, nextNumber.toString());
  return currentNumber;
};

const resetCheckNumberIfNeeded = () => {
  const lastResetTime = fs.existsSync(RESET_TIME_FILE) ? new Date(fs.readFileSync(RESET_TIME_FILE, 'utf8')) : new Date(0);
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  if (now - lastResetTime >= oneDay) {
    fs.writeFileSync(CHECK_NUMBER_FILE, '1');
    fs.writeFileSync(RESET_TIME_FILE, now.toISOString());
  }
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { printer: selectedPrinter, content } = req.body;

    if (!selectedPrinter || !content) {
      return res.status(400).json({ error: 'Printer yoki content yetarli emas' });
    }

    try {
      resetCheckNumberIfNeeded();
      const checkNumber = incrementCheckNumber();
      const pdfFile = 'receipt.pdf';
      const doc = new PDFDocument({
        size: [226.77, 841.89],
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
      });

      const writeStream = fs.createWriteStream(pdfFile);
      doc.pipe(writeStream);

      doc.fontSize(12).font('Helvetica-Bold').text(`Chek raqami: ${checkNumber}`);
      doc.text(`Sana: ${content.dateTime}`);
      doc.text(`Ism: ${content.user?.name || 'Noma’lum'}`);
      doc.text(`Familiya: ${content.user?.surname || 'Noma’lum'}`);
      doc.text(`Yosh: ${content.user?.age || 'Noma’lum'}`);
      doc.text(`Manzil: ${content.user?.address || 'Noma’lum'}`);
      doc.moveDown();
      doc.text('Tanlangan mahsulotlar:', { underline: true });

      content.products.forEach((product) => {
        doc.text(` - ${product.treatmentName}: ${product.price} so'm`);
      });

      doc.moveDown();
      doc.text('Tanlovingiz uchun rahmat! 😊', {
        align: 'center',
        font: 'Helvetica-Bold',
      });

      doc.end();

      writeStream.on('finish', async () => {
        try {
          await printer.print(pdfFile, { printer: selectedPrinter });
          fs.unlinkSync(pdfFile);
          res.json({ message: 'Chek muvaffaqiyatli chiqarildi!' });
        } catch (error) {
          console.error('Chop etishda xatolik:', error);
          res.status(500).json({ error: 'Chop etishda xatolik yuz berdi' });
        }
      });
    } catch (error) {
      console.error('PDF yaratishda xatolik:', error);
      res.status(500).json({ error: 'PDF yaratishda xatolik yuz berdi' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
