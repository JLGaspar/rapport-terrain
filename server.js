const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
 
// Config
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_DESTINATAIRE = process.env.EMAIL_DESTINATAIRE || 'gaspar@dromlag.com';
const EMAIL_RECEPTION = process.env.EMAIL_RECEPTION || process.env.EMAIL_DESTINATAIRE || 'gaspar@dromlag.com';
const EMAIL_EXPEDITEUR = process.env.EMAIL_EXPEDITEUR || 'chaussegaspar@gmail.com';
 
app.use(express.static('public'));
 
app.post('/envoyer', upload.array('photos', 20), async (req, res) => {
  try {
    const { role, nom, chantier, commentaires, typeRapport } = req.body;
    const photos = req.files || [];
    const isReception = typeRapport === 'reception';
    const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
 
    // Validation : PV obligatoire en mode réception
    if (isReception && photos.length === 0) {
      return res.status(400).json({ success: false, error: 'Le PV de réception est obligatoire.' });
    }
 
    // Pièces jointes
    const attachments = photos.map((file, i) => ({
      name: file.originalname || `fichier_${i + 1}.jpg`,
      content: file.buffer.toString('base64'),
      type: file.mimetype || 'image/jpeg',
    }));
 
    // Corps du mail selon le type
    let emailBody;
    let emailSubject;
    let emailTo;
 
    if (isReception) {
      emailTo = EMAIL_RECEPTION;
      emailSubject = `Réception de chantier — ${chantier} — ${nom}`;
 
      // Identifier le PV parmi les fichiers (premier fichier PDF, ou à défaut le premier fichier)
      const pvFile = photos.find(f => f.mimetype === 'application/pdf') || photos[0];
      const photosSupp = photos.filter(f => f !== pvFile);
 
      emailBody = `
RÉCEPTION DE CHANTIER
=====================
Date : ${now}
Envoyé par : ${nom} (${role})
Chantier / Client : ${chantier}
 
PV de réception : ${pvFile ? pvFile.originalname : '—'}
${photosSupp.length > 0 ? `Photos du chantier terminé : ${photosSupp.length} photo(s)` : ''}
 
---
Rapport envoyé automatiquement depuis l'application terrain.
      `.trim();
 
    } else {
      emailTo = EMAIL_DESTINATAIRE;
      emailSubject = `Rapport terrain — ${chantier} — ${nom}`;
 
      let commentairesTexte = '';
      if (commentaires) {
        const comms = Array.isArray(commentaires) ? commentaires : [commentaires];
        comms.forEach((c, i) => {
          if (c) commentairesTexte += `Photo ${i + 1} : ${c}\n`;
        });
      }
 
      emailBody = `
RAPPORT TERRAIN
===============
Date : ${now}
Envoyé par : ${nom} (${role})
Chantier / Client : ${chantier}
${photos.length} photo(s) jointe(s)
${commentairesTexte ? `\nCOMMENTAIRES :\n${commentairesTexte}` : ''}
 
---
Rapport envoyé automatiquement depuis l'application terrain.
      `.trim();
    }
 
    // Appel API Brevo
    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: `${nom} (terrain)`, email: EMAIL_EXPEDITEUR },
      to: [{ email: emailTo }],
      subject: emailSubject,
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
