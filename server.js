const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
// Config
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_DESTINATAIRE = process.env.EMAIL_DESTINATAIRE || 'gaspar@dromlag.com';
const EMAIL_EXPEDITEUR = process.env.EMAIL_EXPEDITEUR || 'chaussegaspar@gmail.com';
app.use(express.static('public'));
app.post('/envoyer', upload.array('photos', 20), async (req, res) => {
  try {
    const { role, nom, chantier, commentaires } = req.body;
    const photos = req.files || [];
    const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    // Préparer les pièces jointes
    const attachments = photos.map((file, i) => ({
      name: file.originalname || `photo_${i + 1}.jpg`,
      content: file.buffer.toString('base64'),
      type: file.mimetype || 'image/jpeg',
    }));
    // Préparer les commentaires par photo
    let commentairesTexte = '';
    if (commentaires) {
      const comms = Array.isArray(commentaires) ? commentaires : [commentaires];
      comms.forEach((c, i) => {
        if (c) commentairesTexte += `Photo ${i + 1} : ${c}\n`;
      });
    }
    // Corps du mail
    const emailBody = `
RAPPORT TERRAIN
===============
Date : ${now}
Envoyé par : ${nom} (${role})
Chantier / Client : ${chantier}
${photos.length} photo(s) jointe(s)
${commentairesTexte ? `COMMENTAIRES :\n${commentairesTexte}` : ''}
---
Rapport envoyé automatiquement depuis l'application terrain.
    `.trim();
    // Appel API Brevo
    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: `${nom} (terrain)`, email: EMAIL_EXPEDITEUR },
      to: [{ email: EMAIL_DESTINATAIRE }],
      subject: `Rapport terrain — ${chantier} — ${nom}`,
      textContent: emailBody,
      attachment: attachments,
    }, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
