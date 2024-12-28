
const express = require('express');
const bodyParser = require('body-parser');
const printer = require('pdf-to-printer');
const cors = require('cors');
const fs = require('fs');
const PDFDocument = require('pdfkit'); // PDF fayl yaratish uchun

const app = express();

app.use(cors());
app.use(bodyParser.json());

const CHECK_NUMBER_FILE = 'check_number.txt'; // Chek raqamini saqlash uchun fayl
const RESET_TIME_FILE = 'last_reset_time.txt'; // Oxirgi reset vaqtini saqlash uchun fayl

// Chek raqamni o'qish yoki boshlang'ich qiymatini o'rnatish
const getCheckNumber = () => {
  if (!fs.existsSync(CHECK_NUMBER_FILE)) {
    fs.writeFileSync(CHECK_NUMBER_FILE, '1'); // Agar fayl mavjud bo'lmasa, 1-dan boshlash
  }
  return parseInt(fs.readFileSync(CHECK_NUMBER_FILE, 'utf8'), 10);
};

// Chek raqamni yangilash
const incrementCheckNumber = () => {
  const currentNumber = getCheckNumber();
  const nextNumber = currentNumber + 1;
  fs.writeFileSync(CHECK_NUMBER_FILE, nextNumber.toString());
  return currentNumber;
};

// Printerlar ro'yxatini olish
app.get('/api/printers', async (req, res) => {
  try {
    const printers = await printer.getPrinters();
    res.json(printers);
  } catch (error) {
    console.error('Printerlarni olishda xatolik:', error);
    res.status(500).json({ error: 'Printerlarni olishda xatolik' });
  }
});

// Chop etish funksiyasi
app.post('/api/print', async (req, res) => {
  const { printer: selectedPrinter, content } = req.body;

  if (!selectedPrinter || !content) {
    return res.status(400).json({ error: 'Printer yoki content yetarli emas' });
  }

  try {
    const checkNumber = incrementCheckNumber(); // Chek raqamini olish
    const pdfFile = 'receipt.pdf';
    const doc = new PDFDocument({
      size: [226.77, 841.89], // 80mm kenglik va uzun qog'oz formati (1mm = 2.83465pt)
      margins: { top: 10, bottom: 10, left: 10, right: 10 },
    });

    const writeStream = fs.createWriteStream(pdfFile);
    doc.pipe(writeStream);

    // Chek matnini PDF formatga yozish
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
        // PDF faylni printerga yuborish
        await printer.print(pdfFile, { printer: selectedPrinter });
        fs.unlinkSync(pdfFile); // PDF faylni o‘chirish
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
});

module.exports = app;
