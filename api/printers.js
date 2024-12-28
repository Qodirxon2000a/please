
const printer = require('pdf-to-printer');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const printers = await printer.getPrinters();
      res.status(200).json(printers);
    } catch (error) {
      console.error('Printerlarni olishda xatolik:', error);
      res.status(500).json({ error: 'Printerlarni olishda xatolik' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
